import { createSocket } from 'node:dgram'

const MAC_PATTERN =
	/^([0-9a-f]{2})[:-]?([0-9a-f]{2})[:-]?([0-9a-f]{2})[:-]?([0-9a-f]{2})[:-]?([0-9a-f]{2})[:-]?([0-9a-f]{2})$/i

/** Accepts `AA:BB:CC:DD:EE:FF`, `AA-BB-CC-DD-EE-FF` or `AABBCCDDEEFF`. */
export function parseMacAddress(mac: string): Buffer | null {
	const match = MAC_PATTERN.exec(mac.trim())
	if (!match) return null
	return Buffer.from(match.slice(1).map((byte) => parseInt(byte, 16)))
}

export function buildMagicPacket(mac: Buffer): Buffer {
	return Buffer.concat([Buffer.alloc(6, 0xff), ...Array<Buffer>(16).fill(mac)])
}

/** Broadcasts Wake-on-LAN magic packets; several are sent since UDP broadcasts can be dropped. */
export async function sendWakeOnLan(mac: string, packets = 10, intervalMs = 100): Promise<void> {
	const macBytes = parseMacAddress(mac)
	if (!macBytes) throw new Error(`Invalid MAC address: ${mac}`)
	const packet = buildMagicPacket(macBytes)

	const socket = createSocket('udp4')
	try {
		await new Promise<void>((resolve, reject) => {
			socket.once('error', reject)
			socket.bind(() => {
				socket.setBroadcast(true)
				resolve()
			})
		})
		for (let i = 0; i < packets; i++) {
			await new Promise<void>((resolve, reject) => {
				socket.send(packet, 9, '255.255.255.255', (err) => (err ? reject(err) : resolve()))
			})
			if (i < packets - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs))
		}
	} finally {
		socket.close()
	}
}
