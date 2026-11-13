import { Regex, SomeCompanionConfigField } from '@companion-module/base'

export type SamsungConfig = {
	host: string
	macAddress: string
	port: number
	/** Absent on connections created before the option existed; treated as enabled. */
	limitTls?: boolean
}

export type SamsungSecrets = {
	/** Pairing token issued by the TV once the user allows the connection. */
	token?: string
}

export function defineConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'pairingInfo',
			label: 'First-Time Pairing Instructions',
			width: 12,
			value: `When connecting for the first time, please make sure your TV is turned on, connected to your network (preferably via Ethernet) and Settings > General > External Device Manager > Device Connect Manager > Access Notification is set to "First Time Only". Then click "Allow" when your TV prompts you to connect.`,
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 6,
			default: '',
			regex: Regex.IP,
		},
		{
			type: 'textinput',
			id: 'macAddress',
			label: 'Target MAC Address',
			width: 6,
			default: '',
			tooltip:
				'Only needed for Power On (Wake-on-LAN). Leave blank to fill it in automatically when the TV is found on the network.',
			// Companion checks empty values against the regex too, so blank must match or Save stays disabled
			regex: '/^$|^[0-9a-fA-F]{2}([:-]?[0-9a-fA-F]{2}){5}$/',
		},
		{
			type: 'number',
			id: 'port',
			label: 'Connection Port',
			width: 6,
			default: 8002,
			min: 1,
			max: 65535,
			tooltip: 'Some older TVs may only use port 8001 (insecure). Default port is 8002.',
		},
		{
			type: 'secret-text',
			id: 'token',
			label: 'Pairing Token',
			width: 6,
			default: '',
			tooltip:
				'Filled in automatically once you allow Companion on the TV. Clear it to pair again, e.g. after replacing or resetting the TV.',
		},
		{
			type: 'checkbox',
			id: 'limitTls',
			label: 'Limit TLS to 1.2',
			width: 6,
			default: true,
			tooltip:
				'Some newer TVs fail the secure connection when TLS 1.3 is negotiated, which shows up as repeated "Allow" prompts. Only applies to port 8002.',
		},
		{
			type: 'static-text',
			id: 'powerOnNote',
			label: 'Note About Power On Command',
			width: 12,
			value: `For most TVs the Power On command will only work with a wired Ethernet connection. The Wi-Fi chipset disconnects from the network when the TV is off.`,
		},
	]
}
