import http from 'node:http'
import https from 'node:https'

/** The parts of `GET /api/v2/` the module uses. Fields are strings on the TVs seen so far ("true", "on"). */
export interface SamsungDeviceSpec {
	/** Only reported by TVs from about 2018 on. */
	PowerState?: string
	FrameTVSupport?: string
}

export interface DeviceInfoResult {
	device: SamsungDeviceSpec
	port: number
}

const PORTS = [8002, 8001]

async function requestDeviceInfo(
	host: string,
	port: number,
	limitTlsTo12: boolean,
	timeoutMs: number,
): Promise<SamsungDeviceSpec> {
	return new Promise((resolve, reject) => {
		const options = { host, port, path: '/api/v2/', timeout: timeoutMs }
		const onResponse = (res: http.IncomingMessage): void => {
			if (res.statusCode !== 200) {
				res.resume()
				reject(new Error(`HTTP ${res.statusCode}`))
				return
			}
			let body = ''
			res.setEncoding('utf8')
			res.on('data', (chunk: string) => (body += chunk))
			res.on('end', () => {
				try {
					const data = JSON.parse(body) as { device?: SamsungDeviceSpec }
					if (!data.device || typeof data.device !== 'object') throw new Error('response has no device section')
					resolve(data.device)
				} catch (err) {
					reject(err instanceof Error ? err : new Error(String(err)))
				}
			})
		}
		// Port 8002 is the TLS port, with a self-signed certificate
		const req =
			port === 8001
				? http.get(options, onResponse)
				: https.get(
						{ ...options, rejectUnauthorized: false, ...(limitTlsTo12 ? { maxVersion: 'TLSv1.2' as const } : {}) },
						onResponse,
					)
		req.on('timeout', () => req.destroy(new Error(`no response within ${timeoutMs}ms`)))
		req.on('error', reject)
	})
}

/**
 * Reads the TV's device info, trying the configured remote port's scheme and the other one in parallel:
 * some TVs only answer on one of them. Resolves to null when neither answers (TV off or unreachable).
 */
export async function fetchDeviceInfo(
	host: string,
	preferredPort: number,
	limitTlsTo12: boolean,
	timeoutMs: number,
): Promise<{ result: DeviceInfoResult | null; errors: string[] }> {
	const ports = [preferredPort, ...PORTS.filter((port) => port !== preferredPort)]
	const errors: string[] = []
	const attempts = ports.map(async (port) => {
		try {
			return { device: await requestDeviceInfo(host, port, limitTlsTo12, timeoutMs), port }
		} catch (err) {
			errors.push(`port ${port}: ${err instanceof Error ? err.message : String(err)}`)
			throw err
		}
	})
	try {
		return { result: await Promise.any(attempts), errors }
	} catch {
		return { result: null, errors }
	}
}
