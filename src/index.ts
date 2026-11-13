import { InstanceBase, InstanceStatus, type InstanceTypes, type SomeCompanionConfigField } from '@companion-module/base'
import { SamsungTvRemote, Keys, getAwakeSamsungDevices, type SamsungDevice } from 'samsung-tv-remote'
import { updateActions, type SamsungActions } from './actions.js'
import { updateVariableDefinitions } from './variables.js'
import { defineConfigFields, type SamsungConfig } from './config.js'

export interface SamsungTypes extends InstanceTypes {
	config: SamsungConfig
	secrets: undefined
	actions: SamsungActions
	variables: Record<string, never>
}

export const UpgradeScripts = []

/** Port for Samsung REST device info (`/api/v2`), not the WebSocket remote port. */
const DEVICE_REST_PORT = 8001
const DEVICE_API_PATH = '/api/v2/'
const POWER_STATE_FETCH_TIMEOUT_MS = 2000
const REMOTE_READY_RETRY_DELAY_MS = 50
const REMOTE_READY_MAX_ATTEMPTS = 10

/** Normalized from `device.PowerState` on `http://<ip>:8001/api/v2`. */
export type DevicePowerState = 'on' | 'standby'

function formatDiscoveredSamsungDevice(device: SamsungDevice): string {
	const friendlyName = device.friendlyName?.trim() || 'Unknown'
	return `${friendlyName} (IP: ${device.ip}, MAC: ${device.mac})`
}

export default class ModuleInstance extends InstanceBase<SamsungTypes> {
	tv: SamsungTvRemote | undefined
	config!: SamsungConfig

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: SamsungConfig, _isFirstInit: boolean): Promise<void> {
		this.config = config

		const devices = await getAwakeSamsungDevices()
		if (devices.length) {
			const list = devices.map(formatDiscoveredSamsungDevice).join('\n')
			this.log('debug', 'Found Samsung TV devices on network:\n' + list)
		} else {
			this.log('debug', 'No Samsung TV devices found on network')
		}

		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'IP address not set')
			return
		}
		if (!this.config.macAddress) {
			this.updateStatus(InstanceStatus.BadConfig, 'MAC address not set')
			return
		}

		this.updateActions()
		this.updateVariableDefinitions()
		this.establishConnection()
	}

	establishConnection(): void {
		this.updateStatus(InstanceStatus.Connecting)

		if (this.tv) {
			this.tv.disconnect()
			this.tv = undefined
		}

		if (!this.config.host || !this.config.macAddress) {
			this.updateStatus(InstanceStatus.BadConfig, 'IP and MAC address are required')
			return
		}

		this.log(
			'debug',
			`Creating remote for TV — IP: ${this.config.host}, port: ${this.config.port ?? 8002}, MAC: ${this.config.macAddress}`,
		)
		this.tv = new SamsungTvRemote({
			ip: this.config.host,
			mac: this.config.macAddress,
			name: 'Bitfocus Connection',
			port: this.config.port ?? 8002,
		})

		this.updateStatus(InstanceStatus.Ok)
	}

	/**
	 * Reads `device.PowerState` from the TV REST API. Returns `null` if the request fails
	 * (e.g. TV fully powered down and not reachable on the network).
	 */
	async fetchDevicePowerState(): Promise<DevicePowerState | null> {
		if (!this.config.host) {
			return null
		}
		const url = `http://${this.config.host}:${DEVICE_REST_PORT}${DEVICE_API_PATH}`
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), POWER_STATE_FETCH_TIMEOUT_MS)
		this.log('debug', `Querying device power API: ${url} (timeout ${POWER_STATE_FETCH_TIMEOUT_MS}ms)`)
		try {
			const res = await fetch(url, { signal: controller.signal })
			if (!res.ok) {
				this.log('debug', `Device API ${url} returned HTTP ${res.status} — falling back to basic control`)
				return null
			}
			const body = await res.text()
			let data: { device?: { PowerState?: string } }
			try {
				data = JSON.parse(body) as { device?: { PowerState?: string } }
			} catch {
				this.log('debug', `Device API responded but body was not valid — falling back to basic control`)
				return null
			}
			const raw = data.device?.PowerState
			if (typeof raw !== 'string') {
				this.log('debug', `Device API responded but had no device.PowerState field — falling back to basic control.`)
				return null
			}
			const normalized: DevicePowerState = raw.trim().toLowerCase() === 'on' ? 'on' : 'standby'
			this.log('debug', `Device API reports PowerState="${raw}" (normalized: ${normalized})`)
			return normalized
		} catch (err: unknown) {
			const reason =
				err instanceof Error && err.name === 'AbortError'
					? `no response within ${POWER_STATE_FETCH_TIMEOUT_MS}ms (endpoint absent, blocked, or TV powered off)`
					: err instanceof Error
						? err.message
						: String(err)
			this.log('debug', `Could not reach device power API at ${url}: ${reason} — falling back to blind control`)
			return null
		} finally {
			clearTimeout(timeout)
		}
	}

	/**
	 * samsung-tv-remote (>= 3.0.6) loads its cached pairing token asynchronously after construction, and
	 * its WebSocket URL is undefined until then, so a key sent right after `new SamsungTvRemote()` fails
	 * with "Invalid URL: undefined". Retry briefly while that load completes.
	 */
	private async sendKeyWhenRemoteReady(tv: SamsungTvRemote, key: keyof typeof Keys): Promise<void> {
		for (let attempt = 1; ; attempt++) {
			try {
				await tv.sendKey(key)
				return
			} catch (err: unknown) {
				const notReady = err instanceof Error && err.message === 'Invalid URL: undefined'
				if (!notReady || attempt >= REMOTE_READY_MAX_ATTEMPTS) throw err
				this.log('debug', `Remote not ready yet (pairing token still loading), retrying key ${key}`)
				await new Promise((resolve) => setTimeout(resolve, REMOTE_READY_RETRY_DELAY_MS))
			}
		}
	}

	async sendKey(key: keyof typeof Keys): Promise<void> {
		if (!key || !(key in Keys)) {
			this.log('error', `Cannot send key — invalid or missing key: ${String(key)}`)
			return
		}
		if (!this.tv) {
			this.log('error', 'Cannot send key — no TV connection configured')
			return
		}
		this.log('debug', `Sending key ${key} to ${this.config.host}:${this.config.port ?? 8002} via WebSocket`)
		try {
			await this.sendKeyWhenRemoteReady(this.tv, key)
			this.log('debug', `Key ${key} sent successfully`)
			this.updateStatus(InstanceStatus.Ok)
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err)
			this.log(
				'error',
				`Failed to send key ${key}: ${message}. If this was a power command, the TV may be off/unreachable, ` +
					`the pairing may not be authorized on the TV, or the connection port may be wrong.`,
			)
			this.updateStatus(InstanceStatus.ConnectionFailure, message)
		}
	}

	async destroy(): Promise<void> {
		if (this.tv) {
			this.tv.disconnect()
			this.tv = undefined
		}
	}

	async configUpdated(config: SamsungConfig): Promise<void> {
		const needsReconnect =
			config.host !== this.config.host ||
			config.port !== this.config.port ||
			config.macAddress !== this.config.macAddress

		this.config = config

		if (needsReconnect) {
			this.establishConnection()
		}
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return defineConfigFields()
	}

	updateActions(): void {
		updateActions(this)
	}

	updateVariableDefinitions(): void {
		updateVariableDefinitions(this)
	}
}
