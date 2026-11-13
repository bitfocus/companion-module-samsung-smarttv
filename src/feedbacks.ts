import { combineRgb } from '@companion-module/base'
import type ModuleInstance from './index.js'

export type SamsungFeedbacks = {
	powerOn: { type: 'boolean'; options: Record<string, never> }
}

export function updateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		powerOn: {
			type: 'boolean',
			name: 'Power: TV is on',
			description: 'True while the TV reports it is on. Standby and unreachable both count as off.',
			defaultStyle: { bgcolor: combineRgb(0, 153, 51), color: combineRgb(255, 255, 255) },
			options: [],
			callback: () => self.powerState === 'on',
		},
	})
}
