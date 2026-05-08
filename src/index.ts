import { InstanceBase, InstanceStatus, runEntrypoint, SomeCompanionConfigField } from '@companion-module/base'
import { SamsungTvRemote, Keys } from 'samsung-tv-remote'
import { updateActions } from './actions.js'
import { updateVariableDefinitions } from './variables.js'
import { defineConfigFields, SamsungConfig } from './config.js'

export class ModuleInstance extends InstanceBase<SamsungConfig> {
	tv: SamsungTvRemote | undefined
	config!: SamsungConfig

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: SamsungConfig, _isFirstInit: boolean): Promise<void> {
		this.config = config

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
