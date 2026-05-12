import { InstanceBase, InstanceStatus, runEntrypoint, SomeCompanionConfigField } from '@companion-module/base'
import { SamsungTvRemote, Keys, getAwakeSamsungDevices, type SamsungDevice } from 'samsung-tv-remote'
import { updateActions } from './actions.js'
import { updateVariableDefinitions } from './variables.js'
import { defineConfigFields, SamsungConfig } from './config.js'

/** Port for Samsung REST device info (`/api/v2`), not the WebSocket remote port. */
const DEVICE_REST_PORT = 8001
const DEVICE_API_PATH = '/api/v2/'
const POWER_STATE_FETCH_TIMEOUT_MS = 5000

/** Normalized from `device.PowerState` on `http://<ip>:8001/api/v2`. */
export type DevicePowerState = 'on' | 'standby'

function formatDiscoveredSamsungDevice(device: SamsungDevice): string {
	const friendlyName = device.friendlyName?.trim() || 'Unknown'
	return `${friendlyName} (IP: ${device.ip}, MAC: ${device.mac})`
}

export class ModuleInstance extends InstanceBase<SamsungConfig> {
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

		this.log('debug', 'Creating remote for TV at ' + this.config.host)
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
		try {
			const res = await fetch(url, { signal: controller.signal })
			if (!res.ok) {
				this.log('debug', `Device API ${url} returned HTTP ${res.status}`)
				return null
			}
			const data = (await res.json()) as { device?: { PowerState?: string } }
			const raw = data.device?.PowerState
			if (typeof raw !== 'string') {
				this.log('debug', 'Device API response had no PowerState')
				return null
			}
			return raw.trim().toLowerCase() === 'on' ? 'on' : 'standby'
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err)
			this.log('debug', `Could not read device power state from ${url}: ${message}`)
			return null
		} finally {
			clearTimeout(timeout)
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
		this.log('debug', `Sending key: ${key}`)
		try {
			await this.tv.sendKey(key)
			this.updateStatus(InstanceStatus.Ok)
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err)
			this.log('error', `Failed to send key ${key}: ${message}`)
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

runEntrypoint(ModuleInstance, [])
