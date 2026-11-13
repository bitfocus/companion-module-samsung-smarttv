import type ModuleInstance from './index.js'

export type SamsungVariables = {
	/** `on`, `standby`, `off` (not reachable) or `unknown` (not checked yet) */
	power_state: string
}

export function updateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({
		power_state: { name: 'Power state (on, standby, off or unknown)' },
	})
}
