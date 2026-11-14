import type { Keys } from 'samsung-tv-remote'
import WebSocket from 'ws'

export type SamsungKey = keyof typeof Keys

/** TVs ping about every 6s; this allows one missed ping plus margin (as homebridge-samsung-tizen does). */
const HEARTBEAT_TIMEOUT_MS = 8000
const CONNECT_SETTLE_MS = 250

export interface SamsungRemoteOptions {
	host: string
	port: number
	/** App name shown in the TV's "Allow" prompt; pairing tokens are tied to it. */
	name: string
	token: string | undefined
	limitTlsTo12: boolean
	/** How long to wait for the TV to accept the connection, including a user answering the pairing prompt. */
	connectTimeoutMs: number
	/** Gap after each command before the next is sent; TVs drop keys that arrive back to back. */
	keyDelayMs: number
	onToken: (token: string) => void
}

interface SamsungChannelMessage {
	event?: string
	data?: { token?: string }
}

/**
 * Minimal client for the Samsung SmartTV remote-control WebSocket channel (2016+ Tizen TVs).
 *
 * The pairing token is supplied by and handed back to the caller, so it can be persisted wherever the caller
 * likes instead of a file on disk.
 */
export class SamsungRemote {
	readonly #options: SamsungRemoteOptions
	#token: string | undefined
	#socket: WebSocket | null = null
	#pendingSocket: WebSocket | null = null
	#connecting: Promise<WebSocket> | null = null
	#queue: Promise<void> = Promise.resolve()
	#readyAt = 0
	#heartbeatTimer: NodeJS.Timeout | undefined
	/** Set by disconnect(). A queued command must not open a socket on a remote that has been replaced. */
	#disposed = false

	constructor(options: SamsungRemoteOptions) {
		this.#options = options
		this.#token = options.token || undefined
	}

	get isConnected(): boolean {
		return !this.#disposed && this.#socket?.readyState === WebSocket.OPEN
	}

	async connect(): Promise<void> {
		await this.#getSocket()
	}

	async sendKey(key: SamsungKey): Promise<void> {
		await this.#enqueue(async () => this.#sendCommand('Click', key))
	}

	/** Presses and holds a key, e.g. KEY_POWER on Frame TVs, where a click only toggles Art Mode. */
	async holdKey(key: SamsungKey, holdMs: number): Promise<void> {
		await this.#enqueue(async () => {
			await this.#sendCommand('Press', key)
			await delay(holdMs)
			await this.#sendCommand('Release', key)
		})
	}

	/** Runs commands one at a time, with a gap after each so the TV doesn't drop keys sent in quick succession. */
	async #enqueue(task: () => Promise<void>): Promise<void> {
		const run = this.#queue.then(task)
		const pause = async (): Promise<void> => delay(this.#options.keyDelayMs)
		this.#queue = run.then(pause, pause)
		return run
	}

	/**
	 * Sends one command, waiting for it to be written. A socket can look open after the TV has dropped it
	 * (e.g. it went to standby), so a failed write is retried once on a fresh connection.
	 */
	async #sendCommand(cmd: 'Click' | 'Press' | 'Release', key: SamsungKey): Promise<void> {
		// "false" as a string, as samsungtvws and homebridge-samsung-tizen send it
		const payload = JSON.stringify({
			method: 'ms.remote.control',
			params: { Cmd: cmd, DataOfCmd: key, Option: 'false', TypeOfRemote: 'SendRemoteKey' },
		})
		for (let attempt = 1; ; attempt++) {
			const socket = await this.#getSocket()
			const settle = this.#readyAt - Date.now()
			if (settle > 0) await delay(settle)
			try {
				await new Promise<void>((resolve, reject) => {
					socket.send(payload, (err) => (err ? reject(err) : resolve()))
				})
				return
			} catch (err) {
				this.#dropSocket(socket)
				if (attempt >= 2) throw err
			}
		}
	}

	#dropSocket(socket: WebSocket): void {
		if (this.#socket === socket) {
			this.#socket = null
			clearTimeout(this.#heartbeatTimer)
		}
		socket.on('error', () => {})
		socket.terminate()
	}

	/**
	 * TVs ping the remote connection roughly every 6s. A missed ping means the TV has gone without closing the
	 * connection (standby, network loss), which writes alone wouldn't reveal. Only armed once a ping has been
	 * seen, so a TV that doesn't ping is never disconnected by this.
	 */
	#armHeartbeat(socket: WebSocket): void {
		clearTimeout(this.#heartbeatTimer)
		this.#heartbeatTimer = setTimeout(() => this.#dropSocket(socket), HEARTBEAT_TIMEOUT_MS)
	}

	disconnect(): void {
		this.#disposed = true
		clearTimeout(this.#heartbeatTimer)
		for (const socket of [this.#socket, this.#pendingSocket]) {
			if (!socket) continue
			// Keep an error listener attached so a late socket error can't become an uncaught exception
			socket.on('error', () => {})
			socket.terminate()
		}
		this.#socket = null
		this.#pendingSocket = null
	}

	async #getSocket(): Promise<WebSocket> {
		if (this.#disposed) throw new Error('Remote connection was closed')
		if (this.#socket?.readyState === WebSocket.OPEN) return this.#socket
		this.#connecting ??= this.#openSocket().finally(() => {
			this.#connecting = null
		})
		return this.#connecting
	}

	#buildUrl(): string {
		const { host, port, name } = this.#options
		const scheme = port === 8001 ? 'ws' : 'wss'
		let url = `${scheme}://${host}:${port}/api/v2/channels/samsung.remote.control`
		url += `?name=${encodeURIComponent(Buffer.from(name).toString('base64'))}`
		if (this.#token) url += `&token=${encodeURIComponent(this.#token)}`
		return url
	}

	async #openSocket(): Promise<WebSocket> {
		return new Promise<WebSocket>((resolve, reject) => {
			const { connectTimeoutMs, limitTlsTo12 } = this.#options
			const socket = new WebSocket(this.#buildUrl(), {
				handshakeTimeout: connectTimeoutMs,
				// TVs use a self-signed certificate
				rejectUnauthorized: false,
				...(limitTlsTo12 ? { maxVersion: 'TLSv1.2' as const } : {}),
			})
			this.#pendingSocket = socket

			let settled = false
			const fail = (err: Error): void => {
				if (settled) return
				settled = true
				clearTimeout(timer)
				if (this.#pendingSocket === socket) this.#pendingSocket = null
				socket.on('error', () => {})
				socket.terminate()
				reject(err)
			}

			const timer = setTimeout(() => {
				fail(
					new Error(
						this.#token
							? `TV did not accept the connection within ${connectTimeoutMs}ms`
							: `TV did not accept the connection within ${connectTimeoutMs}ms — allow "${this.#options.name}" on the TV when prompted`,
					),
				)
			}, connectTimeoutMs)

			socket.on('message', (raw, isBinary) => {
				if (isBinary) return
				let message: SamsungChannelMessage
				try {
					const text = (Array.isArray(raw) ? Buffer.concat(raw) : Buffer.from(raw as ArrayBuffer)).toString('utf8')
					message = JSON.parse(text) as SamsungChannelMessage
				} catch {
					return
				}

				switch (message.event) {
					case 'ms.channel.connect': {
						if (settled) return
						// disconnect() may have run while this message was queued; don't adopt the socket
						if (this.#disposed) {
							fail(new Error('Remote connection was closed'))
							return
						}
						settled = true
						clearTimeout(timer)
						this.#pendingSocket = null
						this.#socket = socket
						// TVs can ignore a key that arrives right after the connection opens
						this.#readyAt = Date.now() + CONNECT_SETTLE_MS

						const token = message.data?.token
						if (token && token !== this.#token) {
							this.#token = token
							this.#options.onToken(token)
						}
						resolve(socket)
						break
					}
					case 'ms.channel.unauthorized':
						fail(new Error(`Connection was denied on the TV — allow "${this.#options.name}" in its device list`))
						break
					case 'ms.channel.timeOut':
						fail(new Error('The pairing prompt on the TV timed out before it was answered'))
						break
				}
			})

			socket.on('ping', () => {
				if (!this.#disposed && this.#socket === socket) this.#armHeartbeat(socket)
			})

			socket.on('error', (err: NodeJS.ErrnoException) => {
				fail(new Error(describeSocketError(err)))
			})

			socket.on('close', () => {
				if (this.#socket === socket) {
					this.#socket = null
					clearTimeout(this.#heartbeatTimer)
				}
				fail(new Error('Connection closed by the TV'))
			})
		})
	}
}

async function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function describeSocketError(err: NodeJS.ErrnoException): string {
	switch (err.code) {
		case 'ECONNREFUSED':
			return 'Connection refused — the TV is off, or the remote-control port is wrong'
		case 'ETIMEDOUT':
			return 'Connection timed out'
		case 'EHOSTDOWN':
			return 'Host is down or service not available'
		case 'EHOSTUNREACH':
			return 'Host is unreachable'
		default:
			return err.message
	}
}
