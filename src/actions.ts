import { Keys } from 'samsung-tv-remote'
import type { ModuleInstance } from './index.js'

const KEY_CHOICES = Object.keys(Keys).map((key) => ({ label: key, id: key }))

const WAKE_RECONNECT_DELAY_MS = 5000

export function updateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		power: {
			name: 'Set Power State',
			options: [
				{
					id: 'power',
					type: 'dropdown',
					label: 'On/Off',
					default: 'powerOn',
					choices: [
						{ label: 'Power On', id: 'powerOn' },
						{ label: 'Power Off', id: 'powerOff' },
					],
				},
			],
			callback: async (event) => {
				const powerState = await self.fetchDevicePowerState()

				if (event.options.power === 'powerOn') {
					if (powerState === 'on') {
						self.log('debug', 'Power on skipped: device API reports PowerState is already on')
						return
					}
					if (powerState === 'standby') {
						self.log('debug', 'Power on: device is in standby — sending KEY_POWER')
						await self.sendKey('KEY_POWER')
						return
					}
					// API unreachable, fall back to Wake-on-LAN.
					if (!self.tv) {
						self.log('error', 'No TV connection configured')
						return
					}
					self.log(
						'debug',
						'Could not read PowerState from device API; sending Wake-on-LAN to: ' + self.config.macAddress,
					)
					try {
						await self.tv.wakeTV()
					} catch (err: unknown) {
						const message = err instanceof Error ? err.message : String(err)
						self.log('error', 'Wake-on-LAN failed: ' + message)
						return
					}
					self.log('debug', 'Waiting for TV to boot...')
					await new Promise((resolve) => setTimeout(resolve, WAKE_RECONNECT_DELAY_MS))
					self.log('debug', 'Re-establishing WebSocket connection...')
					self.establishConnection()
				} else {
					if (powerState !== 'on') {
						self.log(
							'debug',
							'Power off skipped: device API does not report PowerState on (already standby/off or unreachable)',
						)
						return
					}
					self.log('debug', 'Power off: sending KEY_POWER')
					await self.sendKey('KEY_POWER')
				}
			},
		},
		sendButton: {
			name: 'Send Button Command',
			options: [
				{
					id: 'remoteButton',
					type: 'dropdown',
					label: 'Select Button',
					default: 'KEY_MENU',
					choices: KEY_CHOICES,
				},
			],
			callback: async (event) => {
				const remoteButton = event.options.remoteButton
				await self.sendKey(remoteButton as keyof typeof Keys)
			},
		},
	})
}
