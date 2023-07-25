const { InstanceStatus } = require('@companion-module/base')
const { KEYS } = require('samsung-tv-control')
const wol = require('wake_on_lan')

module.exports = function (self) {
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
				if (event.options.power === 'powerOn') {
					const macAddress = self.config.macAddress

					console.log('attempting to wake from mac: ' + self.config.macAddress)
					if (!macAddress || macAddress === '') {
						console.error(
							'Unable to turn on the TV without a macAddress. Turn on the TV first then connect to automatically get the macAddress.'
						)
						return
					}
					console.debug('sending power command to tv')

					wake(macAddress).catch((error) => {
						console.warning('error trying to wake the TV via mac address')
						console.error(error)
					})

					if (self && typeof self.tv !== undefined) {
						self.tv.turnOn().then((value) => {
							if (!self.tv.isAvailable()) {
								console.error('unable to establish connection to TV')
							} else {
								/*console.log('sending return key to exit menu if it opens')
								self.tv.sendKey(KEYS.KEY_RETURN, function (err, res) {
									if (err) {
										console.error(err)
									}
								})*/
							}
						})
					} else {
						console.error('self.tv not defined')
					}
					self.establishConnection()
				} else if (event.options.power === 'powerOff') {
					console.debug('power off')
					if (self && typeof self.tv !== undefined) {
						self.tv
							.isAvailable()
							.then(() => {
								self.tv.sendKey(KEYS.KEY_POWER, function (err, res) {
									if (err) {
										console.error(err)
									} else {
										self.updateStatus('TV Powered Off')
									}
								})
							})
							.catch((e) => console.error(e))
					} else {
						console.error('self.tv not defined')
					}
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
					choices: [
						{ label: 'KEY_0', id: 'KEY_0' },
						{ label: 'KEY_1', id: 'KEY_1' },
						{ label: 'KEY_2', id: 'KEY_2' },
						{ label: 'KEY_3', id: 'KEY_3' },
						{ label: 'KEY_4', id: 'KEY_4' },
						{ label: 'KEY_5', id: 'KEY_5' },
						{ label: 'KEY_6', id: 'KEY_6' },
						{ label: 'KEY_7', id: 'KEY_7' },
						{ label: 'KEY_8', id: 'KEY_8' },
						{ label: 'KEY_9', id: 'KEY_9' },
						{ label: 'KEY_11', id: 'KEY_11' },
						{ label: 'KEY_12', id: 'KEY_12' },
						{ label: 'KEY_16_9', id: 'KEY_16_9' },
						{ label: 'KEY_4_3', id: 'KEY_4_3' },
						{ label: 'KEY_3SPEED', id: 'KEY_3SPEED' },
						{ label: 'KEY_AD', id: 'KEY_AD' },
						{ label: 'KEY_ADDDEL', id: 'KEY_ADDDEL' },
						{ label: 'KEY_ALT_MHP', id: 'KEY_ALT_MHP' },
						{ label: 'KEY_AMBIENT', id: 'KEY_AMBIENT' },
						{ label: 'KEY_ANGLE', id: 'KEY_ANGLE' },
						{ label: 'KEY_ANTENA', id: 'KEY_ANTENA' },
						{ label: 'KEY_ANYNET', id: 'KEY_ANYNET' },
						{ label: 'KEY_ANYVIEW', id: 'KEY_ANYVIEW' },
						{ label: 'KEY_APP_LIST', id: 'KEY_APP_LIST' },
						{ label: 'KEY_ASPECT', id: 'KEY_ASPECT' },
						{ label: 'KEY_AUTO_ARC_ANTENNA_AIR', id: 'KEY_AUTO_ARC_ANTENNA_AIR' },
						{ label: 'KEY_AUTO_ARC_ANTENNA_CABLE', id: 'KEY_AUTO_ARC_ANTENNA_CABLE' },
						{ label: 'KEY_AUTO_ARC_ANTENNA_SATELLITE', id: 'KEY_AUTO_ARC_ANTENNA_SATELLITE' },
						{ label: 'KEY_AUTO_ARC_ANYNET_AUTO_START', id: 'KEY_AUTO_ARC_ANYNET_AUTO_START' },
						{ label: 'KEY_AUTO_ARC_ANYNET_MODE_OK', id: 'KEY_AUTO_ARC_ANYNET_MODE_OK' },
						{ label: 'KEY_AUTO_ARC_AUTOCOLOR_FAIL', id: 'KEY_AUTO_ARC_AUTOCOLOR_FAIL' },
						{ label: 'KEY_AUTO_ARC_AUTOCOLOR_SUCCESS', id: 'KEY_AUTO_ARC_AUTOCOLOR_SUCCESS' },
						{ label: 'KEY_AUTO_ARC_C_FORCE_AGING', id: 'KEY_AUTO_ARC_C_FORCE_AGING' },
						{ label: 'KEY_AUTO_ARC_CAPTION_ENG', id: 'KEY_AUTO_ARC_CAPTION_ENG' },
						{ label: 'KEY_AUTO_ARC_CAPTION_KOR', id: 'KEY_AUTO_ARC_CAPTION_KOR' },
						{ label: 'KEY_AUTO_ARC_CAPTION_OFF', id: 'KEY_AUTO_ARC_CAPTION_OFF' },
						{ label: 'KEY_AUTO_ARC_CAPTION_ON', id: 'KEY_AUTO_ARC_CAPTION_ON' },
						{ label: 'KEY_AUTO_ARC_JACK_IDENT', id: 'KEY_AUTO_ARC_JACK_IDENT' },
						{ label: 'KEY_AUTO_ARC_LNA_OFF', id: 'KEY_AUTO_ARC_LNA_OFF' },
						{ label: 'KEY_AUTO_ARC_LNA_ON', id: 'KEY_AUTO_ARC_LNA_ON' },
						{ label: 'KEY_AUTO_ARC_PIP_CH_CHANGE', id: 'KEY_AUTO_ARC_PIP_CH_CHANGE' },
						{ label: 'KEY_AUTO_ARC_PIP_DOUBLE', id: 'KEY_AUTO_ARC_PIP_DOUBLE' },
						{ label: 'KEY_AUTO_ARC_PIP_LARGE', id: 'KEY_AUTO_ARC_PIP_LARGE' },
						{ label: 'KEY_AUTO_ARC_PIP_LEFT_BOTTOM', id: 'KEY_AUTO_ARC_PIP_LEFT_BOTTOM' },
						{ label: 'KEY_AUTO_ARC_PIP_LEFT_TOP', id: 'KEY_AUTO_ARC_PIP_LEFT_TOP' },
						{ label: 'KEY_AUTO_ARC_PIP_RIGHT_BOTTOM', id: 'KEY_AUTO_ARC_PIP_RIGHT_BOTTOM' },
						{ label: 'KEY_AUTO_ARC_PIP_RIGHT_TOP', id: 'KEY_AUTO_ARC_PIP_RIGHT_TOP' },
						{ label: 'KEY_AUTO_ARC_PIP_SMALL', id: 'KEY_AUTO_ARC_PIP_SMALL' },
						{ label: 'KEY_AUTO_ARC_PIP_SOURCE_CHANGE', id: 'KEY_AUTO_ARC_PIP_SOURCE_CHANGE' },
						{ label: 'KEY_AUTO_ARC_PIP_WIDE', id: 'KEY_AUTO_ARC_PIP_WIDE' },
						{ label: 'KEY_AUTO_ARC_RESET', id: 'KEY_AUTO_ARC_RESET' },
						{ label: 'KEY_AUTO_ARC_USBJACK_INSPECT', id: 'KEY_AUTO_ARC_USBJACK_INSPECT' },
						{ label: 'KEY_AUTO_FORMAT', id: 'KEY_AUTO_FORMAT' },
						{ label: 'KEY_AUTO_PROGRAM', id: 'KEY_AUTO_PROGRAM' },
						{ label: 'KEY_AV1', id: 'KEY_AV1' },
						{ label: 'KEY_AV2', id: 'KEY_AV2' },
						{ label: 'KEY_AV3', id: 'KEY_AV3' },
						{ label: 'KEY_BACK_MHP', id: 'KEY_BACK_MHP' },
						{ label: 'KEY_BOOKMARK', id: 'KEY_BOOKMARK' },
						{ label: 'KEY_CALLER_ID', id: 'KEY_CALLER_ID' },
						{ label: 'KEY_CAPTION', id: 'KEY_CAPTION' },
						{ label: 'KEY_CATV_MODE', id: 'KEY_CATV_MODE' },
						{ label: 'KEY_CH_LIST', id: 'KEY_CH_LIST' },
						{ label: 'KEY_CHDOWN', id: 'KEY_CHDOWN' },
						{ label: 'KEY_CHUP', id: 'KEY_CHUP' },
						{ label: 'KEY_CLEAR', id: 'KEY_CLEAR' },
						{ label: 'KEY_CLOCK_DISPLAY', id: 'KEY_CLOCK_DISPLAY' },
						{ label: 'KEY_COMPONENT1', id: 'KEY_COMPONENT1' },
						{ label: 'KEY_COMPONENT2', id: 'KEY_COMPONENT2' },
						{ label: 'KEY_CONTENTS', id: 'KEY_CONTENTS' },
						{ label: 'KEY_CONVERGENCE', id: 'KEY_CONVERGENCE' },
						{ label: 'KEY_CONVERT_AUDIO_MAINSUB', id: 'KEY_CONVERT_AUDIO_MAINSUB' },
						{ label: 'KEY_CUSTOM', id: 'KEY_CUSTOM' },
						{ label: 'KEY_CYAN', id: 'KEY_CYAN' },
						{ label: 'KEY_DEVICE_CONNECT', id: 'KEY_DEVICE_CONNECT' },
						{ label: 'KEY_DISC_MENU', id: 'KEY_DISC_MENU' },
						{ label: 'KEY_DMA', id: 'KEY_DMA' },
						{ label: 'KEY_DNET', id: 'KEY_DNET' },
						{ label: 'KEY_DNIe', id: 'KEY_DNIe' },
						{ label: 'KEY_DNSe', id: 'KEY_DNSe' },
						{ label: 'KEY_DOOR', id: 'KEY_DOOR' },
						{ label: 'KEY_DOWN', id: 'KEY_DOWN' },
						{ label: 'KEY_DSS_MODE', id: 'KEY_DSS_MODE' },
						{ label: 'KEY_DTV', id: 'KEY_DTV' },
						{ label: 'KEY_DTV_LINK', id: 'KEY_DTV_LINK' },
						{ label: 'KEY_DTV_SIGNAL', id: 'KEY_DTV_SIGNAL' },
						{ label: 'KEY_DVD_MODE', id: 'KEY_DVD_MODE' },
						{ label: 'KEY_DVI', id: 'KEY_DVI' },
						{ label: 'KEY_DVR', id: 'KEY_DVR' },
						{ label: 'KEY_DVR_MENU', id: 'KEY_DVR_MENU' },
						{ label: 'KEY_DYNAMIC', id: 'KEY_DYNAMIC' },
						{ label: 'KEY_ENTER', id: 'KEY_ENTER' },
						{ label: 'KEY_ENTERTAINMENT', id: 'KEY_ENTERTAINMENT' },
						{ label: 'KEY_ESAVING', id: 'KEY_ESAVING' },
						{ label: 'KEY_EXIT', id: 'KEY_EXIT' },
						{ label: 'KEY_EXT1', id: 'KEY_EXT1' },
						{ label: 'KEY_EXT10', id: 'KEY_EXT10' },
						{ label: 'KEY_EXT11', id: 'KEY_EXT11' },
						{ label: 'KEY_EXT12', id: 'KEY_EXT12' },
						{ label: 'KEY_EXT13', id: 'KEY_EXT13' },
						{ label: 'KEY_EXT14', id: 'KEY_EXT14' },
						{ label: 'KEY_EXT15', id: 'KEY_EXT15' },
						{ label: 'KEY_EXT16', id: 'KEY_EXT16' },
						{ label: 'KEY_EXT17', id: 'KEY_EXT17' },
						{ label: 'KEY_EXT18', id: 'KEY_EXT18' },
						{ label: 'KEY_EXT19', id: 'KEY_EXT19' },
						{ label: 'KEY_EXT2', id: 'KEY_EXT2' },
						{ label: 'KEY_EXT20', id: 'KEY_EXT20' },
						{ label: 'KEY_EXT21', id: 'KEY_EXT21' },
						{ label: 'KEY_EXT22', id: 'KEY_EXT22' },
						{ label: 'KEY_EXT23', id: 'KEY_EXT23' },
						{ label: 'KEY_EXT24', id: 'KEY_EXT24' },
						{ label: 'KEY_EXT25', id: 'KEY_EXT25' },
						{ label: 'KEY_EXT26', id: 'KEY_EXT26' },
						{ label: 'KEY_EXT27', id: 'KEY_EXT27' },
						{ label: 'KEY_EXT28', id: 'KEY_EXT28' },
						{ label: 'KEY_EXT29', id: 'KEY_EXT29' },
						{ label: 'KEY_EXT3', id: 'KEY_EXT3' },
						{ label: 'KEY_EXT30', id: 'KEY_EXT30' },
						{ label: 'KEY_EXT31', id: 'KEY_EXT31' },
						{ label: 'KEY_EXT32', id: 'KEY_EXT32' },
						{ label: 'KEY_EXT33', id: 'KEY_EXT33' },
						{ label: 'KEY_EXT34', id: 'KEY_EXT34' },
						{ label: 'KEY_EXT35', id: 'KEY_EXT35' },
						{ label: 'KEY_EXT36', id: 'KEY_EXT36' },
						{ label: 'KEY_EXT37', id: 'KEY_EXT37' },
						{ label: 'KEY_EXT38', id: 'KEY_EXT38' },
						{ label: 'KEY_EXT39', id: 'KEY_EXT39' },
						{ label: 'KEY_EXT4', id: 'KEY_EXT4' },
						{ label: 'KEY_EXT40', id: 'KEY_EXT40' },
						{ label: 'KEY_EXT41', id: 'KEY_EXT41' },
						{ label: 'KEY_EXT5', id: 'KEY_EXT5' },
						{ label: 'KEY_EXT6', id: 'KEY_EXT6' },
						{ label: 'KEY_EXT7', id: 'KEY_EXT7' },
						{ label: 'KEY_EXT8', id: 'KEY_EXT8' },
						{ label: 'KEY_EXT9', id: 'KEY_EXT9' },
						{ label: 'KEY_FACTORY', id: 'KEY_FACTORY' },
						{ label: 'KEY_FAVCH', id: 'KEY_FAVCH' },
						{ label: 'KEY_FF', id: 'KEY_FF' },
						{ label: 'KEY_FF_', id: 'KEY_FF_' },
						{ label: 'KEY_FM_RADIO', id: 'KEY_FM_RADIO' },
						{ label: 'KEY_GAME', id: 'KEY_GAME' },
						{ label: 'KEY_GREEN', id: 'KEY_GREEN' },
						{ label: 'KEY_GUIDE', id: 'KEY_GUIDE' },
						{ label: 'KEY_HDMI', id: 'KEY_HDMI' },
						{ label: 'KEY_HDMI1', id: 'KEY_HDMI1' },
						{ label: 'KEY_HDMI2', id: 'KEY_HDMI2' },
						{ label: 'KEY_HDMI3', id: 'KEY_HDMI3' },
						{ label: 'KEY_HDMI4', id: 'KEY_HDMI4' },
						{ label: 'KEY_HELP', id: 'KEY_HELP' },
						{ label: 'KEY_HOME', id: 'KEY_HOME' },
						{ label: 'KEY_ID_INPUT', id: 'KEY_ID_INPUT' },
						{ label: 'KEY_ID_SETUP', id: 'KEY_ID_SETUP' },
						{ label: 'KEY_INFO', id: 'KEY_INFO' },
						{ label: 'KEY_INSTANT_REPLAY', id: 'KEY_INSTANT_REPLAY' },
						{ label: 'KEY_LEFT', id: 'KEY_LEFT' },
						{ label: 'KEY_LINK', id: 'KEY_LINK' },
						{ label: 'KEY_LIVE', id: 'KEY_LIVE' },
						{ label: 'KEY_MAGIC_BRIGHT', id: 'KEY_MAGIC_BRIGHT' },
						{ label: 'KEY_MAGIC_CHANNEL', id: 'KEY_MAGIC_CHANNEL' },
						{ label: 'KEY_MDC', id: 'KEY_MDC' },
						{ label: 'KEY_MENU', id: 'KEY_MENU' },
						{ label: 'KEY_MIC', id: 'KEY_MIC' },
						{ label: 'KEY_MORE', id: 'KEY_MORE' },
						{ label: 'KEY_MOVIE1', id: 'KEY_MOVIE1' },
						{ label: 'KEY_MS', id: 'KEY_MS' },
						{ label: 'KEY_MTS', id: 'KEY_MTS' },
						{ label: 'KEY_MULTI_VIEW', id: 'KEY_MULTI_VIEW' },
						{ label: 'KEY_MUTE', id: 'KEY_MUTE' },
						{ label: 'KEY_NINE_SEPERATE', id: 'KEY_NINE_SEPERATE' },
						{ label: 'KEY_OPEN', id: 'KEY_OPEN' },
						{ label: 'KEY_PANNEL_CHDOWN', id: 'KEY_PANNEL_CHDOWN' },
						{ label: 'KEY_PANNEL_CHUP', id: 'KEY_PANNEL_CHUP' },
						{ label: 'KEY_PANNEL_ENTER', id: 'KEY_PANNEL_ENTER' },
						{ label: 'KEY_PANNEL_MENU', id: 'KEY_PANNEL_MENU' },
						{ label: 'KEY_PANNEL_POWER', id: 'KEY_PANNEL_POWER' },
						{ label: 'KEY_PANNEL_SOURCE', id: 'KEY_PANNEL_SOURCE' },
						{ label: 'KEY_PANNEL_VOLDOW', id: 'KEY_PANNEL_VOLDOW' },
						{ label: 'KEY_PANNEL_VOLUP', id: 'KEY_PANNEL_VOLUP' },
						{ label: 'KEY_PANORAMA', id: 'KEY_PANORAMA' },
						{ label: 'KEY_PAUSE', id: 'KEY_PAUSE' },
						{ label: 'KEY_PCMODE', id: 'KEY_PCMODE' },
						{ label: 'KEY_PERPECT_FOCUS', id: 'KEY_PERPECT_FOCUS' },
						{ label: 'KEY_PICTURE_SIZE', id: 'KEY_PICTURE_SIZE' },
						{ label: 'KEY_PIP_CHDOWN', id: 'KEY_PIP_CHDOWN' },
						{ label: 'KEY_PIP_CHUP', id: 'KEY_PIP_CHUP' },
						{ label: 'KEY_PIP_ONOFF', id: 'KEY_PIP_ONOFF' },
						{ label: 'KEY_PIP_SCAN', id: 'KEY_PIP_SCAN' },
						{ label: 'KEY_PIP_SIZE', id: 'KEY_PIP_SIZE' },
						{ label: 'KEY_PIP_SWAP', id: 'KEY_PIP_SWAP' },
						{ label: 'KEY_PLAY', id: 'KEY_PLAY' },
						{ label: 'KEY_PLUS100', id: 'KEY_PLUS100' },
						{ label: 'KEY_PMODE', id: 'KEY_PMODE' },
						{ label: 'KEY_POWER', id: 'KEY_POWER' },
						{ label: 'KEY_POWEROFF', id: 'KEY_POWEROFF' },
						{ label: 'KEY_POWERON', id: 'KEY_POWERON' },
						{ label: 'KEY_PRECH', id: 'KEY_PRECH' },
						{ label: 'KEY_PRINT', id: 'KEY_PRINT' },
						{ label: 'KEY_PROGRAM', id: 'KEY_PROGRAM' },
						{ label: 'KEY_QUICK_REPLAY', id: 'KEY_QUICK_REPLAY' },
						{ label: 'KEY_REC', id: 'KEY_REC' },
						{ label: 'KEY_RED', id: 'KEY_RED' },
						{ label: 'KEY_REPEAT', id: 'KEY_REPEAT' },
						{ label: 'KEY_RESERVED1', id: 'KEY_RESERVED1' },
						{ label: 'KEY_RETURN', id: 'KEY_RETURN' },
						{ label: 'KEY_REWIND', id: 'KEY_REWIND' },
						{ label: 'KEY_REWIND_', id: 'KEY_REWIND_' },
						{ label: 'KEY_RIGHT', id: 'KEY_RIGHT' },
						{ label: 'KEY_RSS', id: 'KEY_RSS' },
						{ label: 'KEY_RSURF', id: 'KEY_RSURF' },
						{ label: 'KEY_SCALE', id: 'KEY_SCALE' },
						{ label: 'KEY_SEFFECT', id: 'KEY_SEFFECT' },
						{ label: 'KEY_SETUP_CLOCK_TIMER', id: 'KEY_SETUP_CLOCK_TIMER' },
						{ label: 'KEY_SLEEP', id: 'KEY_SLEEP' },
						{ label: 'KEY_SOURCE', id: 'KEY_SOURCE' },
						{ label: 'KEY_SRS', id: 'KEY_SRS' },
						{ label: 'KEY_STANDARD', id: 'KEY_STANDARD' },
						{ label: 'KEY_STB_MODE', id: 'KEY_STB_MODE' },
						{ label: 'KEY_STILL_PICTURE', id: 'KEY_STILL_PICTURE' },
						{ label: 'KEY_STOP', id: 'KEY_STOP' },
						{ label: 'KEY_SUB_TITLE', id: 'KEY_SUB_TITLE' },
						{ label: 'KEY_SVIDEO1', id: 'KEY_SVIDEO1' },
						{ label: 'KEY_SVIDEO2', id: 'KEY_SVIDEO2' },
						{ label: 'KEY_SVIDEO3', id: 'KEY_SVIDEO3' },
						{ label: 'KEY_TOOLS', id: 'KEY_TOOLS' },
						{ label: 'KEY_TOPMENU', id: 'KEY_TOPMENU' },
						{ label: 'KEY_TTX_MIX', id: 'KEY_TTX_MIX' },
						{ label: 'KEY_TTX_SUBFACE', id: 'KEY_TTX_SUBFACE' },
						{ label: 'KEY_TURBO', id: 'KEY_TURBO' },
						{ label: 'KEY_TV', id: 'KEY_TV' },
						{ label: 'KEY_TV_MODE', id: 'KEY_TV_MODE' },
						{ label: 'KEY_UP', id: 'KEY_UP' },
						{ label: 'KEY_VCHIP', id: 'KEY_VCHIP' },
						{ label: 'KEY_VCR_MODE', id: 'KEY_VCR_MODE' },
						{ label: 'KEY_VOLDOWN', id: 'KEY_VOLDOWN' },
						{ label: 'KEY_VOLUP', id: 'KEY_VOLUP' },
						{ label: 'KEY_W_LINK', id: 'KEY_W_LINK' },
						{ label: 'KEY_WHEEL_LEFT', id: 'KEY_WHEEL_LEFT' },
						{ label: 'KEY_WHEEL_RIGHT', id: 'KEY_WHEEL_RIGHT' },
						{ label: 'KEY_YELLOW', id: 'KEY_YELLOW' },
						{ label: 'KEY_ZOOM_IN', id: 'KEY_ZOOM_IN' },
						{ label: 'KEY_ZOOM_MOVE', id: 'KEY_ZOOM_MOVE' },
						{ label: 'KEY_ZOOM_OUT', id: 'KEY_ZOOM_OUT' },
						{ label: 'KEY_ZOOM1', id: 'KEY_ZOOM1' },
						{ label: 'KEY_ZOOM2', id: 'KEY_ZOOM2' },
					],
				},
			],
			callback: async (event) => {
				if (self && typeof self.tv !== undefined) {
					self.tv
						.isAvailable()
						.then(() => {
							console.log('sending key command: ' + event.options.remoteButton)
							self.tv.sendKey(KEYS[event.options.remoteButton], function (err, res) {
								if (err) {
									console.error(err)
								} else if (event.options.remoteButton == 'KEY_POWEROFF' || event.options.remoteButton == 'KEY_POWER') {
									self.updateStatus('TV Powered Off')
								} else {
									self.updateStatus(InstanceStatus.Ok)
								}
							})
						})
						.catch((e) => console.error(e))
				} else {
					console.error('self.tv not defined')
				}
			},
		},
	})
}

function wake(mac) {
	return new Promise(function (resolve, reject) {
		wol.wake(mac, function (error) {
			if (error) {
				reject(error)
			} else {
				resolve()
			}
		})
	})
}
