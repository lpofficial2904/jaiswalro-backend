import { createServer } from 'node:http'
import { handler as sendBookingEmail } from './functions/send-booking-email.mjs'
import sendWhatsApp from './functions/send-whatsapp.mjs'

const port = Number(process.env.PORT || 3001)
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CORS_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean),
])
const routes = new Map([
  ['/api/forms/email', sendBookingEmail],
  ['/api/forms/whatsapp', sendWhatsApp],
])
const maxBodyBytes = 32 * 1024

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let tooLarge = false

    request.on('data', chunk => {
      size += chunk.length
      if (size > maxBodyBytes) {
        tooLarge = true
        return
      }
      if (!tooLarge) chunks.push(chunk)
    })
    request.on('end', () => {
      if (tooLarge) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }))
        return
      }
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    request.on('error', reject)
  })
}

async function handleRequest(request, response) {
  const url = new URL(request.url || '/', 'http://localhost')
  const origin = request.headers.origin

  if (origin && !allowedOrigins.has(origin)) {
    return sendJson(response, 403, { error: 'Origin is not allowed.' })
  }

  response.setHeader('Vary', 'Origin')
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin)

  if (url.pathname === '/health') {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      return sendJson(response, 405, { error: 'Method not allowed.' })
    }
    return sendJson(response, 200, { ok: true })
  }

  const handler = routes.get(url.pathname)
  if (!handler) return sendJson(response, 404, { error: 'Route not found.' })

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    })
    return response.end()
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS')
    return sendJson(response, 405, { error: 'Method not allowed.' })
  }

  if (!request.headers['content-type']?.toLowerCase().includes('application/json')) {
    return sendJson(response, 415, { error: 'Content-Type must be application/json.' })
  }

  try {
    const body = await readBody(request)
    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      return sendJson(response, 400, { error: 'Request body must be valid JSON.' })
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return sendJson(response, 400, { error: 'Request body must be a JSON object.' })
    }
    if (payload.fields !== undefined && (!payload.fields || typeof payload.fields !== 'object' || Array.isArray(payload.fields))) {
      return sendJson(response, 400, { error: 'Form fields must be a JSON object.' })
    }

    let result
    if (url.pathname === '/api/forms/email') {
      result = await handler({ httpMethod: 'POST', body: JSON.stringify({ ...payload, fields: payload.fields || {} }) })
      const headers = Object.fromEntries(
        Object.entries(result.headers || {}).filter(([name]) => !name.toLowerCase().startsWith('access-control-')),
      )
      response.writeHead(result.statusCode || 200, headers)
      return response.end(result.body || '')
    }

    const forwardedRequest = new Request(`http://localhost${url.pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, fields: payload.fields || {} }),
    })
    result = await handler(forwardedRequest)
    response.writeHead(result.status, {
      'Content-Type': result.headers.get('content-type') || 'application/json; charset=utf-8',
    })
    return response.end(await result.text())
  } catch (error) {
    if (!response.headersSent) {
      console.error('API request failed', error)
      return sendJson(response, error.statusCode || 500, {
        error: error.statusCode === 413 ? error.message : 'Request process nahi ho saki. Please dobara try karein.',
      })
    }
    response.destroy(error)
  }
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port between 1 and 65535.')
}

createServer((request, response) => {
  handleRequest(request, response)
}).listen(port, '0.0.0.0', () => {
  console.log(`Jaiswalro API listening on port ${port}`)
})
