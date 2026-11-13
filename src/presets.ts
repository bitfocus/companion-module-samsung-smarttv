import {
	combineRgb,
	type CompanionPresetDefinitions,
	type CompanionPresetSection,
	type CompanionSimplePresetDefinition,
} from '@companion-module/base'
import type ModuleInstance from './index.js'
import type { SamsungTypes } from './index.js'
import type { SamsungKey } from './remote.js'

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const GREEN = combineRgb(0, 153, 51)
const RED = combineRgb(204, 0, 0)

function keyPreset(name: string, text: string, key: SamsungKey): CompanionSimplePresetDefinition<SamsungTypes> {
	return {
		type: 'simple',
		name,
		style: { text, size: 'auto', color: WHITE, bgcolor: BLACK },
		steps: [{ down: [{ actionId: 'sendButton', options: { remoteButton: key } }], up: [] }],
		feedbacks: [],
	}
}

function powerPreset(name: string, power: 'powerOn' | 'powerOff'): CompanionSimplePresetDefinition<SamsungTypes> {
	return {
		type: 'simple',
		name,
		style: { text: power === 'powerOn' ? 'POWER\\nON' : 'POWER\\nOFF', size: 'auto', color: WHITE, bgcolor: BLACK },
		steps: [{ down: [{ actionId: 'power', options: { power } }], up: [] }],
		feedbacks: [
			power === 'powerOn'
				? { feedbackId: 'powerOn', options: {}, style: { bgcolor: GREEN, color: WHITE } }
				: { feedbackId: 'powerOn', options: {}, isInverted: true, style: { bgcolor: RED, color: WHITE } },
		],
	}
}

/** Preset sections, each a list of `[presetId, preset]` in display order. */
const SECTIONS: { id: string; name: string; presets: [string, CompanionSimplePresetDefinition<SamsungTypes>][] }[] = [
	{
		id: 'power',
		name: 'Power',
		presets: [
			['powerOn', powerPreset('Power On', 'powerOn')],
			['powerOff', powerPreset('Power Off', 'powerOff')],
			['powerToggle', keyPreset('Power Toggle', 'POWER', 'KEY_POWER')],
		],
	},
	{
		id: 'volume',
		name: 'Volume',
		presets: [
			['volumeUp', keyPreset('Volume Up', 'VOL\\n+', 'KEY_VOLUP')],
			['volumeDown', keyPreset('Volume Down', 'VOL\\n-', 'KEY_VOLDOWN')],
			['mute', keyPreset('Mute', 'MUTE', 'KEY_MUTE')],
		],
	},
	{
		id: 'channel',
		name: 'Channel',
		presets: [
			['channelUp', keyPreset('Channel Up', 'CH\\n+', 'KEY_CHUP')],
			['channelDown', keyPreset('Channel Down', 'CH\\n-', 'KEY_CHDOWN')],
			['previousChannel', keyPreset('Previous Channel', 'PREV\\nCH', 'KEY_PRECH')],
			['channelList', keyPreset('Channel List', 'CH\\nLIST', 'KEY_CH_LIST')],
			['guide', keyPreset('Guide', 'GUIDE', 'KEY_GUIDE')],
		],
	},
	{
		id: 'navigation',
		name: 'Navigation',
		presets: [
			['up', keyPreset('Up', 'UP', 'KEY_UP')],
			['down', keyPreset('Down', 'DOWN', 'KEY_DOWN')],
			['left', keyPreset('Left', 'LEFT', 'KEY_LEFT')],
			['right', keyPreset('Right', 'RIGHT', 'KEY_RIGHT')],
			['enter', keyPreset('Enter / OK', 'OK', 'KEY_ENTER')],
			['back', keyPreset('Back', 'BACK', 'KEY_RETURN')],
			['home', keyPreset('Home', 'HOME', 'KEY_HOME')],
			['menu', keyPreset('Menu', 'MENU', 'KEY_MENU')],
			['info', keyPreset('Info', 'INFO', 'KEY_INFO')],
			['tools', keyPreset('Tools', 'TOOLS', 'KEY_TOOLS')],
		],
	},
	{
		id: 'inputs',
		name: 'Inputs',
		presets: [
			['source', keyPreset('Source', 'SOURCE', 'KEY_SOURCE')],
			['hdmi', keyPreset('HDMI (cycle)', 'HDMI', 'KEY_HDMI')],
			['hdmi1', keyPreset('HDMI 1', 'HDMI 1', 'KEY_HDMI1')],
			['hdmi2', keyPreset('HDMI 2', 'HDMI 2', 'KEY_HDMI2')],
			['hdmi3', keyPreset('HDMI 3', 'HDMI 3', 'KEY_HDMI3')],
			['hdmi4', keyPreset('HDMI 4', 'HDMI 4', 'KEY_HDMI4')],
			['tv', keyPreset('TV', 'TV', 'KEY_TV')],
		],
	},
	{
		id: 'playback',
		name: 'Playback',
		presets: [
			['play', keyPreset('Play', 'PLAY', 'KEY_PLAY')],
			['pause', keyPreset('Pause', 'PAUSE', 'KEY_PAUSE')],
			['stop', keyPreset('Stop', 'STOP', 'KEY_STOP')],
			['rewind', keyPreset('Rewind', 'REW', 'KEY_REWIND')],
			['fastForward', keyPreset('Fast Forward', 'FF', 'KEY_FF')],
		],
	},
	{
		id: 'numbers',
		name: 'Numbers',
		presets: (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map((digit) => [
			`number${digit}`,
			keyPreset(`Number ${digit}`, digit, `KEY_${digit}`),
		]),
	},
]

export function updatePresets(self: ModuleInstance): void {
	const structure: CompanionPresetSection<SamsungTypes>[] = SECTIONS.map((section) => ({
		id: section.id,
		name: section.name,
		definitions: section.presets.map(([id]) => id),
	}))
	const presets: CompanionPresetDefinitions<SamsungTypes> = Object.fromEntries(
		SECTIONS.flatMap((section) => section.presets),
	)
	self.setPresetDefinitions(structure, presets)
}
