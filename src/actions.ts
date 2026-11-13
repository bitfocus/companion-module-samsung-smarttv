import type { CompanionActionSchemaWithoutResult } from '@companion-module/base'
import { Keys } from 'samsung-tv-remote'
import type ModuleInstance from './index.js'

export type SamsungActions = {
	power: CompanionActionSchemaWithoutResult<{ power: 'powerOn' | 'powerOff' }>
	sendButton: CompanionActionSchemaWithoutResult<{ remoteButton: keyof typeof Keys }>
}

const KEY_CHOICES = Object.keys(Keys).map((key) => ({ label: key, id: key }))

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
				const powerState = await self.readPowerState(true)
				self.log('debug', `Power action requested: ${event.options.power}; detected power state: ${powerState}`)

				if (event.options.power === 'powerOn') {
					if (powerState === 'on') {
						self.log('debug', 'Power on skipped: the TV is already on')
						return
					}
					if (powerState === 'standby') {
						// Also covers turning the TV back on while it is still powering off
						self.log('debug', 'Power on: the TV is in standby — sending KEY_POWER')
						self.clearPoweringOff()
						if (await self.sendKey('KEY_POWER', null)) self.setPowerState('on')
						return
					}
					// TV not reachable: it is fully off, so fall back to Wake-on-LAN.
					self.log('debug', 'TV not reachable; sending Wake-on-LAN to: ' + self.config.macAddress)
					let awake: boolean
					try {
						awake = await self.wakeTv()
					} catch (err: unknown) {
						const message = err instanceof Error ? err.message : String(err)
						self.log('error', `Wake-on-LAN failed: ${message}`)
						return
					}
					if (!awake) {
						self.log(
							'error',
							`TV did not come up after Wake-on-LAN. Confirm MAC ${self.config.macAddress} is correct and the TV is on wired Ethernet.`,
						)
						return
					}
					self.log('debug', 'TV is up; re-establishing WebSocket connection...')
					self.establishConnection()
				} else {
					if (powerState === 'standby' || powerState === 'off') {
						self.log('debug', `Power off skipped: the TV is already ${powerState}`)
						return
					}
					self.log('debug', 'Power off: sending KEY_POWER')
					await self.sendPowerOff()
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
				await self.sendKey(event.options.remoteButton, null)
			},
		},
	})
}
