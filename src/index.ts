import { InstanceBase, InstanceStatus, type InstanceTypes, type SomeCompanionConfigField } from '@companion-module/base'
import { Keys, getAwakeSamsungDevices, type SamsungDevice } from 'samsung-tv-remote'
import { updateActions, type SamsungActions } from './actions.js'
import { defineConfigFields, type SamsungConfig, type SamsungSecrets } from './config.js'
import { fetchDeviceInfo, type SamsungDeviceSpec } from './deviceInfo.js'
import { updateFeedbacks, type SamsungFeedbacks } from './feedbacks.js'
import { updatePresets } from './presets.js'
import { SamsungRemote, type SamsungKey } from './remote.js'
import { updateVariableDefinitions, type SamsungVariables } from './variables.js'
import { sendWakeOnLan } from './wake.js'

export interface SamsungTypes extends InstanceTypes {
	config: SamsungConfig
	secrets: SamsungSecrets
	actions: SamsungActions
	feedbacks: SamsungFeedbacks
	variables: SamsungVariables
}

export const UpgradeScripts = []

const DEVICE_INFO_TIMEOUT_MS = 2000
const DEFAULT_REMOTE_PORT = 8002
/** Name shown in the TV's "Allow" prompt. Pairing tokens are tied to it. */
const REMOTE_APP_NAME = 'Bitfocus Connection'
const CONNECT_TIMEOUT_MS = 5000
/** Long enough for someone to walk to the TV and answer the pairing prompt. */
const PAIRING_TIMEOUT_MS = 30000
const WAKE_TIMEOUT_MS = 30000
const WAKE_POLL_INTERVAL_MS = 1000
const POWER_POLL_INTERVAL_MS = 5000
/** TVs keep reporting PowerState "on" for a few seconds after KEY_POWER, so trust the power-off for this long. */
const POWER_OFF_GRACE_MS = POWER_POLL_INTERVAL_MS + 5000
/**
 * TVs that don't report PowerState stay reachable for a while as they shut down, and reachable is all there is to
 * judge them by, so they need longer (homebridge-samsung-tizen uses 20s for these too).
 */
const POWER_OFF_GRACE_NO_POWERSTATE_MS = 20000
/** samsung-tv-remote, which this module used before, waited 60ms between keys. */
const KEY_DELAY_MS = 60
/** Frame TVs only switch to Art Mode on a click of KEY_POWER; holding it turns them off. */
const FRAME_POWER_HOLD_MS = 3000
const NO_MAC = '00:00:00:00:00:00'

/**
 * `on`/`standby` come from the TV's device info (`/api/v2/`); `off` means the TV couldn't be reached;
 * `unknown` means it hasn't been checked yet.
 */
export type PowerState = 'on' | 'standby' | 'off' | 'unknown'

function formatDiscoveredSamsungDevice(device: SamsungDevice): string {
	const friendlyName = device.friendlyName?.trim() || 'Unknown'
	return `${friendlyName} (IP: ${device.ip}, MAC: ${device.mac})`
}

export default class ModuleInstance extends InstanceBase<SamsungTypes> {
	tv: SamsungRemote | undefined
	config!: SamsungConfig
	secrets: SamsungSecrets = {}
	powerState: PowerState = 'unknown'
	/** Last device info the TV reported, kept for capabilities such as Frame TV support. */
	deviceSpec: SamsungDeviceSpec | undefined
	#powerOffUntil = 0
	#powerPollTimer: NodeJS.Timeout | undefined
	#powerPollGeneration = 0

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: SamsungConfig, _isFirstInit: boolean, secrets: SamsungSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets ?? {}

		// Registered even when the config is incomplete: configUpdated doesn't re-register them
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()
		this.setPowerState('unknown')

		await this.fillMacAddressFromDiscovery()
		this.establishConnection()
		this.startPowerPolling()
	}

	/**
	 * Logs Samsung TVs found on the network and, when the MAC address is blank, fills it in from the
	 * discovered TV matching the configured IP.
	 */
	async fillMacAddressFromDiscovery(): Promise<void> {
		const devices = await getAwakeSamsungDevices()
		if (devices.length) {
			const list = devices.map(formatDiscoveredSamsungDevice).join('\n')
			this.log('debug', 'Found Samsung TV devices on network:\n' + list)
		} else {
			this.log('debug', 'No Samsung TV devices found on network')
		}

		if (!this.config.host || this.config.macAddress) return
		const match = devices.find((device) => device.ip === this.config.host && device.mac && device.mac !== NO_MAC)
		if (!match) return
		this.log('info', `Filled in MAC address ${match.mac} from the TV found at ${match.ip}`)
		this.config = { ...this.config, macAddress: match.mac }
		this.saveConfig(this.config, undefined)
	}

	get remotePort(): number {
		return this.config.port ?? DEFAULT_REMOTE_PORT
	}

	saveToken(token: string): void {
		this.secrets = { ...this.secrets, token }
		this.saveConfig(undefined, this.secrets)
	}

	establishConnection(): void {
		if (this.tv) {
			this.tv.disconnect()
			this.tv = undefined
		}

		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'IP address not set')
			return
		}

		const paired = !!this.secrets.token
		const limitTlsTo12 = this.config.limitTls ?? true
		this.log(
			'debug',
			`Creating remote for TV — IP: ${this.config.host}, port: ${this.remotePort}, MAC: ${this.config.macAddress || 'not set'}, ` +
				`paired: ${paired}, TLS limited to 1.2: ${limitTlsTo12}`,
		)
		const tv = new SamsungRemote({
			host: this.config.host,
			port: this.remotePort,
			name: REMOTE_APP_NAME,
			token: this.secrets.token,
			limitTlsTo12,
			connectTimeoutMs: paired ? CONNECT_TIMEOUT_MS : PAIRING_TIMEOUT_MS,
			keyDelayMs: KEY_DELAY_MS,
			onToken: (token) => {
				this.log('info', 'Paired with the TV; pairing token saved to this connection')
				this.saveToken(token)
			},
		})
		this.tv = tv

		// Connect up front so a first-time pairing prompt appears now rather than on the first button press
		this.connectRemote(tv)
	}

	/** Connects in the background, reflecting the outcome in the connection status. */
	connectRemote(tv: SamsungRemote): void {
		this.updateStatus(InstanceStatus.Connecting, this.secrets.token ? null : `Allow "${REMOTE_APP_NAME}" on the TV`)
		tv.connect().then(
			() => {
				if (this.tv === tv) this.updateStatus(InstanceStatus.Ok)
			},
			(err: unknown) => {
				if (this.tv !== tv) return
				const message = err instanceof Error ? err.message : String(err)
				this.log('debug', `Could not connect to TV: ${message}`)
				this.updateStatus(InstanceStatus.Disconnected, message)
			},
		)
	}

	/** Reads the TV's device info. Returns null when the TV can't be reached (fully off, or wrong IP). */
	async readDeviceSpec(verbose: boolean): Promise<SamsungDeviceSpec | null> {
		if (!this.config.host) return null
		const { result, errors } = await fetchDeviceInfo(
			this.config.host,
			this.remotePort,
			this.config.limitTls ?? true,
			DEVICE_INFO_TIMEOUT_MS,
		)
		if (!result) {
			if (verbose) this.log('debug', `Could not read device info from ${this.config.host}: ${errors.join('; ')}`)
			return null
		}
		if (verbose) this.log('debug', `Device info from port ${result.port}: ${JSON.stringify(result.device)}`)
		this.deviceSpec = result.device
		return result.device
	}

	get powerOffInProgress(): boolean {
		return Date.now() < this.#powerOffUntil
	}

	/** Treat the TV as off for a while after KEY_POWER, so a second Power Off can't toggle it back on. */
	markPoweringOff(): void {
		const reportsPowerState = typeof this.deviceSpec?.PowerState === 'string'
		this.#powerOffUntil = Date.now() + (reportsPowerState ? POWER_OFF_GRACE_MS : POWER_OFF_GRACE_NO_POWERSTATE_MS)
		this.setPowerState('standby')
	}

	clearPoweringOff(): void {
		this.#powerOffUntil = 0
	}

	async readPowerState(verbose: boolean): Promise<PowerState> {
		if (this.powerOffInProgress) {
			if (verbose) this.log('debug', 'Power off was sent moments ago; treating the TV as in standby')
			return 'standby'
		}
		const spec = await this.readDeviceSpec(verbose)
		if (!spec) return 'off'
		if (typeof spec.PowerState === 'string') return spec.PowerState.trim().toLowerCase() === 'on' ? 'on' : 'standby'

		// TVs from before about 2018 don't report PowerState. Like Home Assistant, fall back to whether the remote
		// connection works; skip that while unpaired so polling doesn't keep raising the pairing prompt.
		// This connect() does not go through connectRemote, and setPowerState will not connect again once the
		// socket is already open, so the status has to be published here or a TV that was off at startup stays
		// "Disconnected" after it comes on.
		if (!this.tv || !this.secrets.token) return 'on'
		const tv = this.tv
		try {
			await tv.connect()
			// A config change may have replaced the remote while this connect was in flight
			if (this.tv !== tv) return this.powerState
			this.updateStatus(InstanceStatus.Ok)
			return 'on'
		} catch {
			if (this.tv !== tv) return this.powerState
			return 'standby'
		}
	}

	/**
	 * Sends Wake-on-LAN, then waits for the TV's device API to answer. Avoids shelling out to `ping`, whose
	 * flags differ between platforms and which isn't always on Companion's PATH.
	 */
	async wakeTv(): Promise<boolean> {
		if (!this.config.macAddress) throw new Error('No MAC address configured, so Wake-on-LAN cannot be sent')
		await sendWakeOnLan(this.config.macAddress)
		const deadline = Date.now() + WAKE_TIMEOUT_MS
		while (Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, WAKE_POLL_INTERVAL_MS))
			if ((await this.readDeviceSpec(false)) !== null) return true
		}
		return false
	}

	setPowerState(state: PowerState): void {
		if (state === this.powerState && state !== 'unknown') return
		const turnedOn = state === 'on' && this.powerState !== 'on'
		this.powerState = state
		this.setVariableValues({ power_state: state })
		this.checkFeedbacks('powerOn')

		// The start-up connection fails if the TV was off, so (re)connect when it comes on. This is also when a
		// first-time pairing prompt can actually be shown.
		if (turnedOn && this.tv && !this.tv.isConnected) {
			this.log('debug', 'TV turned on; connecting to it')
			this.connectRemote(this.tv)
		}
	}

	startPowerPolling(): void {
		this.stopPowerPolling()
		if (!this.config.host) return
		const generation = this.#powerPollGeneration
		const poll = async (): Promise<void> => {
			try {
				const state = await this.readPowerState(false)
				// Ignore results from a poll loop that was stopped (config change, destroy) while it was in flight
				if (generation !== this.#powerPollGeneration) return
				this.setPowerState(state)
			} catch (err: unknown) {
				if (generation !== this.#powerPollGeneration) return
				const message = err instanceof Error ? err.message : String(err)
				this.log('debug', `Could not read power state: ${message}`)
			}
			if (generation !== this.#powerPollGeneration) return
			this.#powerPollTimer = setTimeout(() => void poll(), POWER_POLL_INTERVAL_MS)
		}
		void poll()
	}

	stopPowerPolling(): void {
		this.#powerPollGeneration++
		clearTimeout(this.#powerPollTimer)
		this.#powerPollTimer = undefined
	}

	/**
	 * Sends a key, or holds it for `holdMs` when that isn't null. Returns whether it was sent; failures are logged
	 * and reflected in the connection status.
	 */
	async sendKey(key: SamsungKey, holdMs: number | null): Promise<boolean> {
		if (!key || !(key in Keys)) {
			this.log('error', `Cannot send key — invalid or missing key: ${String(key)}`)
			return false
		}
		if (!this.tv) {
			this.log('error', 'Cannot send key — no TV connection configured')
			return false
		}
		const how = holdMs === null ? '' : ` (held ${holdMs}ms)`
		this.log('debug', `Sending key ${key}${how} to ${this.config.host}:${this.remotePort} via WebSocket`)
		try {
			if (holdMs === null) await this.tv.sendKey(key)
			else await this.tv.holdKey(key, holdMs)
			this.log('debug', `Key ${key} sent successfully`)
			this.updateStatus(InstanceStatus.Ok)
			return true
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err)
			this.log(
				'error',
				`Failed to send key ${key}: ${message}. If this was a power command, the TV may be off/unreachable, ` +
					`the pairing may not be authorized on the TV, or the connection port may be wrong.`,
			)
			this.updateStatus(InstanceStatus.ConnectionFailure, message)
			return false
		}
	}

	/** Turns the TV off; Frame TVs need KEY_POWER held, or a click just toggles Art Mode. */
	async sendPowerOff(): Promise<void> {
		const isFrame = this.deviceSpec?.FrameTVSupport === 'true'
		const sent = await this.sendKey('KEY_POWER', isFrame ? FRAME_POWER_HOLD_MS : null)
		if (sent) this.markPoweringOff()
	}

	async destroy(): Promise<void> {
		this.stopPowerPolling()
		if (this.tv) {
			this.tv.disconnect()
			this.tv = undefined
		}
	}

	async configUpdated(config: SamsungConfig, secrets: SamsungSecrets): Promise<void> {
		secrets ??= {}
		const needsReconnect =
			config.host !== this.config.host ||
			config.port !== this.config.port ||
			config.limitTls !== this.config.limitTls ||
			secrets.token !== this.secrets.token

		const hostChanged = config.host !== this.config.host

		this.config = config
		this.secrets = secrets

		if (!this.config.macAddress) await this.fillMacAddressFromDiscovery()
		if (needsReconnect) {
			this.establishConnection()
		}
		if (hostChanged) {
			this.deviceSpec = undefined
			this.clearPoweringOff()
			this.setPowerState('unknown')
			this.startPowerPolling()
		}
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return defineConfigFields()
	}

	updateActions(): void {
		updateActions(this)
	}

	updateFeedbacks(): void {
		updateFeedbacks(this)
	}

	updateVariableDefinitions(): void {
		updateVariableDefinitions(this)
	}

	updatePresets(): void {
		updatePresets(this)
	}
}
