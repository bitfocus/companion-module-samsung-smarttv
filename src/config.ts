import { Regex, SomeCompanionConfigField } from '@companion-module/base'

export interface SamsungConfig {
	host: string
	macAddress: string
	port: number
}

export function defineConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'pairingInfo',
			label: 'First-Time Pairing Instructions',
			width: 12,
			value: `When connecting for the first time, please make sure your TV is turned on, connected to your network (preferably via Ethernet) and Settings > General > External Device Manager > Device Connect Manager > Access Notification is set to "First Time Only". Then click "Allow" when your TV prompts you to allow Bitfocus Companion to connect. Click on the question mark for additional pairing instructions.`,
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
			tooltip: 'Required for Wake-on-LAN',
			regex: Regex.MAC_ADDRESS,
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
			type: 'static-text',
			id: 'powerOnNote',
			label: 'Note About Power On Command',
			width: 12,
			value: `For most TVs the Power On command will only work with a wired Ethernet connection. The Wi-Fi chipset disconnects from the network when the TV is off.`,
		},
	]
}
