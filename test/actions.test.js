const assert = require('node:assert/strict')
const { once } = require('node:events')
const http = require('node:http')
const { test } = require('node:test')
const { WebSocketServer } = require('ws')
const { Samsung } = require('samsung-tv-control')
const { InstanceStatus } = require('@companion-module/base')
const updateActions = require('../actions')

test('remote key and power-off actions use Samsung HTTP and WebSocket protocols', { timeout: 10000 }, async (t) => {
	const paths = []
	const server = http.createServer((request, response) => {
		paths.push(request.url)
		response.writeHead(200, { 'Content-Type': 'application/json' })
		response.end('{}')
	})
	const websocket = new WebSocketServer({ server })
	t.after(async () => {
		for (const client of websocket.clients) client.terminate()
		websocket.close()
		await new Promise((resolve) => server.close(resolve))
	})
	const messages = []
	websocket.on('connection', (socket, request) => {
		assert.match(request.url, /^\/api\/v2\/channels\/samsung.remote.control\?name=/)
		assert.match(request.url, /&token=test-token$/)
		socket.on('message', (message) => {
			messages.push(JSON.parse(message))
			socket.send(JSON.stringify({ event: 'ms.channel.connect', data: { token: 'test-token' } }))
		})
	})
	server.listen(8001, '127.0.0.1')
	await once(server, 'listening')
	const self = {
		tv: new Samsung({ ip: '127.0.0.1', mac: '00:11:22:33:44:55', port: 8001, token: 'test-token' }),
		setActionDefinitions(definitions) {
			this.actions = definitions
		},
		updateStatus(status) {
			this.status = status
		},
	}
	updateActions(self)
	for (const [action, options, key, status] of [
		['sendButton', { remoteButton: 'KEY_HDMI1' }, 'KEY_HDMI1', InstanceStatus.Ok],
		['power', { power: 'powerOff' }, 'KEY_POWER', 'TV Powered Off'],
	]) {
		self.status = undefined
		await self.actions[action].callback({ options })
		while (self.status === undefined) await new Promise((resolve) => setTimeout(resolve, 10))
		assert.equal(self.status, status)
		assert.deepEqual(messages.at(-1), {
			method: 'ms.remote.control',
			params: { Cmd: 'Click', DataOfCmd: key, Option: 'false', TypeOfRemote: 'SendRemoteKey' },
		})
	}
	assert.deepEqual(paths, ['/api/v2/', '/api/v2/'])
})
