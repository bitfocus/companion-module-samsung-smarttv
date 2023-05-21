const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpdateActions = require('./actions')
const UpdateVariableDefinitions = require('./variables')

const macfromip = require('macfromip')
const { Samsung, APPS, AutoSearch } = require('samsung-tv-control')

/**
* Companion instance class for Samsung Smart TVs
*
* @author Author <user@example.com>
*/

class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		this.config = config
		
		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'IP address not set')
			return
		}
		
		if (!this.config.macAddress || this.config.macAddress === '') {
			this.updateStatus(InstanceStatus.BadConfig, 'MAC address not set')
		}
		
		if(!this.config.port){
			console.debug('No port found, setting to default (8002)')
			this.config.port = 8002;
		}
		
		// attempt to connec to the TV
		this.establishConnection()
		//this.findTVsOnLan()

		this.updateActions()
		this.updateVariableDefinitions()
	}
	
	establishConnection() {
		this.updateStatus(InstanceStatus.Connecting)

		if(this.tv && this.tv.isAvailable()){
			this.tv.closeConnection()
		}
		
		if (this.config.host) {
			if (!this.config.macAddress || this.config.macAddress === '') {
				console.debug('attempting to get mac from ip ' + this.config.host)
				const localRef = this;
				
				macfromip.getMac(this.config.host, function(err, data) {
					if(!err){
						localRef.config.macAddress = data;
						localRef.saveConfig(localRef.config)
						console.log('mac: ' + localRef.config.macAddress)
						console.log(localRef)
						localRef.establishConnection()
					}else{
						console.error('issue getting mac from ip ' + err + ' | ' + data)
						localRef.updateStatus(InstanceStatus.ConnectionFailure, 'Unable to determine mac by ip. Ensure device is powered on.')
					}
				})
			}
		}
		
		if(this.config.host && this.config.macAddress && this.config.macAddress !== ""){
			
			if(!this.config.token){
				console.debug('no token found, establishing first time connection?')
			}
			
			const config = {
				debug: false, // Default: false
				ip: this.config.host,
				mac: this.config.macAddress,
				nameApp: 'Bitfocus Companion',
				port: this.config.port || 8002,
				token: this.config.token,
			}
			
			console.debug('attempting connection to tv')
			try{
				this.tv = new Samsung(config)
				this.tv.isAvailable().then(() => {
					console.debug('connection established')
					console.debug(this.tv)
					this.updateStatus(InstanceStatus.Ok)
					
					// Get token for websocket access
					this.tv.getToken((token) => {
						if(token){
							console.debug('Token: ' + token)
							this.config.token = token
							this.saveConfig(this.config)
						}
					})
					
				}).catch((e) => {
					console.error(e)
					if(e.code == "ECONNREFUSED"){
						console.log('unable to connect (1)')
						this.updateStatus(InstanceStatus.Disconnected)
					}
				});
			}catch(e){
				console.log('unable to connect (2)')
				console.error(e)
				this.updateStatus(InstanceStatus.Disconnected)
			}
		}
	}
	
	findTVsOnLan() {
		console.debug('searching for other tvs on network')
		this.search = new AutoSearch()
		this.search.search(30000)
		console.log(this.search);
	}
	
	// When module gets deleted or disabled
	async destroy() {
		if (this.tv !== undefined) {
			this.tv.closeConnection()
			this.tv = undefined
		}
		
		console.log('destroy')
	}
	
	async configUpdated(config) {
		console.log('Configuration updated')
		console.log(config)
		await this.init(config)
	}

	// Return config fields for web config
	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				label: 'First-Time Pairing Instructions',
				width: 12,
				value: `
				When connecting for the first time, please make sure your TV is turned on, connected to your network (preferably via Ethernet) and Settings > General > External Device Manager > Device Connect Manager > Access Notification is set to "First Time Only". Then click "Allow" when your TV prompts you to allow Bitfocus Companion to connect. Click on the question mark for additional pairing instructions.
			`
			},
			/*
			{
				type: 'dropdown',
				id: 'host',
				label: 'Target IP',
				width: 6,
				//choices: this.CHOICES_DEVICES,
				default: '',
				allowCustom: true,
				regex: Regex.IP
			},*/
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 6,
				default: '',
				allowCustom: true,
				regex: Regex.IP
			},
			{
				type: 'textinput',
				id: 'macAddress',
				label: 'Target Mac Address (automatically found)',
				width: 6,
				default: '',
					regex: '/^([0-9a-f]{2}([:.-]{0,1}|$)){6}$/i'
			},
			{
				type: 'textinput',
				id: 'token',
				label: 'Token (automatically created)',
				width: 6
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Connection Port',
				width: 6,
				default: '8002',
				tooltip: 'Some older TVs may only use port 8001 (insecure). Default port is 8002.',
				regex: this.REGEX_PORT,
			},
			{
				type: 'static-text',
				id: 'info',
				label: 'Note About Power On Command',
				width: 12,
				value: `
				For most TVs the Power On command will only work with a wired Ethernet connection. The Wi-Fi chipset disconnects from the network when the TV is off.
			`
			}
		]
	}

	updateActions(){
		UpdateActions(this)
	}

	updateVariableDefinitions(){
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(ModuleInstance, [])
