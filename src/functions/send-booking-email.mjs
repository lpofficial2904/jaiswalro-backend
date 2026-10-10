import nodemailer from 'nodemailer'
import { lookup } from 'node:dns'
import net from 'node:net'
import tls from 'node:tls'

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const allowedForms = {
  contact: {
    title: 'CONTACT FORM',
    subject: 'New contact enquiry',
    fields: [['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['subject', 'Enquiry type'], ['message', 'Message']],
  },
  product: {
    title: 'PRODUCT BOOKING',
    subject: 'New product booking',
    fields: [['product', 'Product'], ['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['location', 'Location'], ['pincode', 'Pincode'], ['message', 'Requirement']],
  },
  service: {
    title: 'SERVICE BOOKING',
    subject: 'New service booking',
    fields: [['service', 'Service'], ['plan', 'Plan'], ['price', 'Price'], ['name', 'Name'], ['mobile', 'Mobile'], ['fullAddress', 'Full address'], ['pincode', 'Pincode'], ['preferredDate', 'Preferred date'], ['problem', 'RO problem / notes']],
  },
}

const clean = value => String(value ?? '').trim().slice(0, 1000)
const json = (body, statusCode = 200) => ({
  statusCode,
  headers: jsonHeaders,
  body: JSON.stringify(body),
})
const escapeHtml = value => clean(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]))

const isValidEmail = value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const brand = {
  name: 'Jaiswalro Services',
  phone: '+91 9694727871',
  email: 'jaiswalroservices@gmail.com',
  address: '13/884, Deendayal Upadhyay Market, Malviya Nagar, Jaipur',
}

function lookupIpv4(hostname, options, callback) {
  lookup(hostname, { ...options, family: 4 }, callback)
}

function createSmtpSocket({ host, port, secure }) {
  return (_options, callback) => {
    lookup(host, { family: 4 }, (lookupError, address) => {
      if (lookupError) {
        callback(lookupError)
        return
      }

      const connectionOptions = {
        host: address,
        port,
        family: 4,
        servername: host,
        timeout: 7000,
      }
      const connection = secure
        ? tls.connect(connectionOptions)
        : net.connect(connectionOptions)
      let settled = false
      const done = (error, socketInfo) => {
        if (settled) return
        settled = true
        callback(error, socketInfo)
      }

      connection.once('timeout', () => {
        connection.destroy(Object.assign(new Error('SMTP socket timed out.'), { code: 'ETIMEDOUT' }))
      })
      connection.once('error', error => done(error))
      connection.once(secure ? 'secureConnect' : 'connect', () => done(null, { connection, secured: secure }))
    })
  }
}

async function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) return null
  const secure = process.env.SMTP_SECURE === 'true' || port === 465

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    family: 4,
    lookup: lookupIpv4,
    getSocket: createSmtpSocket({ host, port, secure }),
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 12000,
  })
}

function isConnectionTimeoutError(error) {
  return error.code === 'ETIMEDOUT'
    || error.name === 'TimeoutError'
    || error.name === 'AbortError'
    || (error.code === 'ESOCKET' && /ENETUNREACH|ETIMEDOUT|timeout/i.test(error.message || ''))
}

function getSmtpTimeoutMessage() {
  const host = clean(process.env.SMTP_HOST)
  const port = clean(process.env.SMTP_PORT || '587')
  const isRender = clean(process.env.RENDER).toLowerCase() === 'true'

  if (isRender && ['25', '465', '587'].includes(port)) {
    return `Email server connection timed out. Render free services block SMTP port ${port}; use a paid Render instance or an SMTP relay on an allowed port like 2525.`
  }

  return `Email server connection timed out. Please check SMTP host ${host || 'value'}, port ${port}, and hosting provider network access.`
}

function verifyTransporterWithTimeout(transporter) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      transporter.close()
      reject(Object.assign(new Error('SMTP verify timed out.'), { code: 'ETIMEDOUT' }))
    }, 8000)

    transporter.verify().then(
      result => {
        clearTimeout(timeout)
        resolve(result)
      },
      error => {
        clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

function sendMailWithTimeout(transporter, message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      transporter.close()
      reject(Object.assign(new Error('SMTP request timed out.'), { code: 'ETIMEDOUT' }))
    }, 15000)

    transporter.sendMail(message).then(
      info => {
        clearTimeout(timeout)
        resolve(info)
      },
      error => {
        clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

function getMissingEmailConfig() {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_TO']

  return required
    .filter(key => !clean(process.env[key]))
}

function getEmailConfigError() {
  const missingConfig = getMissingEmailConfig()
  if (missingConfig.length) {
    return `Missing email environment variables: ${missingConfig.join(', ')}`
  }

  const host = clean(process.env.SMTP_HOST).toLowerCase()
  const user = clean(process.env.SMTP_USER)
  const pass = clean(process.env.SMTP_PASS)
  const from = clean(process.env.MAIL_FROM)

  if (host === 'smtp.sendgrid.net' && user !== 'apikey') {
    return 'SendGrid SMTP_USER must be exactly "apikey".'
  }
  if (/^(your_|YOUR_|SG\.xxxxx|your-sendgrid)/.test(pass)) {
    return 'SMTP_PASS must be a real SMTP password or SendGrid API key.'
  }
  if (from.includes('verified_sender_email') || from.includes('your_verified_sender_email')) {
    return 'MAIL_FROM must use a real verified sender email.'
  }

  return ''
}

export function getEmailConfigStatus() {
  const smtpConfigured = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].every(key => clean(process.env[key]))
  const missingConfig = getMissingEmailConfig()
  const configError = getEmailConfigError()

  return {
    ok: !configError,
    provider: smtpConfigured ? 'smtp' : 'none',
    missingConfig,
    ...(configError ? { error: configError } : {}),
  }
}

export async function verifyEmailConfig() {
  const status = getEmailConfigStatus()
  if (!status.ok) return status

  let transporter
  try {
    transporter = await getTransporter()
    if (!transporter) {
      return { ...status, ok: false, error: 'SMTP transporter could not be created.' }
    }
    await verifyTransporterWithTimeout(transporter)
    transporter.close()
    return { ...status, ok: true, smtpReachable: true }
  } catch (error) {
    transporter?.close()
    return {
      ...status,
      ok: false,
      smtpReachable: false,
      error: isConnectionTimeoutError(error)
        ? getSmtpTimeoutMessage()
        : clean(error.message),
      code: error.code || error.name,
    }
  }
}

function getFormMeta(formType, fields) {
  if (formType === 'service') {
    return {
      badge: 'Service booking',
      heading: clean(fields.service) || 'Service booking request',
      summary: [
        ['Plan', clean(fields.plan) || 'Service visit'],
        ['Price', clean(fields.price) || 'To be confirmed'],
        ['Visit date', clean(fields.preferredDate) || 'Not selected'],
      ],
    }
  }

  if (formType === 'product') {
    return {
      badge: 'Product booking',
      heading: clean(fields.product) || 'Product booking request',
      summary: [
        ['Product', clean(fields.product) || 'RO purifier'],
        ['Location', clean(fields.location) || 'Not provided'],
        ['Pincode', clean(fields.pincode) || 'Not provided'],
      ],
    }
  }

  return {
    badge: 'Contact enquiry',
    heading: clean(fields.subject) || 'Website contact enquiry',
    summary: [
      ['Name', clean(fields.name)],
      ['Phone', clean(fields.phone)],
      ['Email', clean(fields.email) || 'Not provided'],
    ],
  }
}

function buildEmailContent({ formType, config, fields, rows, timestamp }) {
  const meta = getFormMeta(formType, fields)
  const customerName = clean(fields.name)
  const customerPhone = clean(fields.phone || fields.mobile)
  const customerEmail = clean(fields.email)
  const callHref = `tel:${brand.phone.replace(/\s/g, '')}`
  const mailHref = `mailto:${brand.email}`
  const summaryCards = meta.summary
    .filter(([, value]) => value)
    .map(([label, value]) => `
      <td style="width:33.33%;padding:0 6px 12px 6px;vertical-align:top">
        <div style="border:1px solid #d9eeee;border-radius:14px;background:#f7fcfc;padding:13px 14px">
          <div style="font-size:11px;line-height:16px;color:#6b8790;text-transform:uppercase;letter-spacing:.08em;font-weight:700">${escapeHtml(label)}</div>
          <div style="font-size:15px;line-height:21px;color:#082e3b;font-weight:700;margin-top:4px">${escapeHtml(value)}</div>
        </div>
      </td>
    `).join('')
  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <th align="left" style="width:38%;padding:13px 16px;border-bottom:1px solid #e5f0f1;background:#fbfefe;color:#31535d;font-size:13px;line-height:19px;font-weight:700">${escapeHtml(label)}</th>
      <td style="padding:13px 16px;border-bottom:1px solid #e5f0f1;color:#082e3b;font-size:14px;line-height:21px;font-weight:500;white-space:pre-line">${escapeHtml(value)}</td>
    </tr>
  `).join('')

  const text = [
    `NEW ${config.title}`,
    `Received: ${timestamp}`,
    '',
    `${meta.heading}`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    `${brand.name}`,
    `${brand.phone}`,
    `${brand.email}`,
  ].join('\n')

  const html = `<!doctype html>
  <html>
    <body style="margin:0;padding:0;background:#edf7f7;font-family:Arial,Helvetica,sans-serif;color:#082e3b">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf7f7;padding:28px 12px">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #cfe8e8;box-shadow:0 18px 45px rgba(6,54,64,.12)">
              <tr>
                <td style="background:#062f3a;padding:24px 28px;color:#ffffff">
                  <div style="font-size:12px;line-height:18px;letter-spacing:.12em;text-transform:uppercase;color:#7fe1d9;font-weight:800">${escapeHtml(meta.badge)}</div>
                  <h1 style="margin:8px 0 6px 0;font-size:26px;line-height:32px;font-weight:800;color:#ffffff">New website request</h1>
                  <p style="margin:0;color:#c6dde1;font-size:14px;line-height:22px">Received from ${escapeHtml(customerName)} on ${escapeHtml(timestamp)}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 22px 8px 22px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>${summaryCards}</tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 28px 22px 28px">
                  <h2 style="margin:0 0 14px 0;font-size:20px;line-height:26px;color:#082e3b">${escapeHtml(meta.heading)}</h2>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #d9eeee;border-radius:16px;overflow:hidden;border-collapse:separate;border-spacing:0">
                    ${htmlRows}
                    <tr>
                      <th align="left" style="width:38%;padding:13px 16px;background:#fbfefe;color:#31535d;font-size:13px;line-height:19px;font-weight:700">Received</th>
                      <td style="padding:13px 16px;color:#082e3b;font-size:14px;line-height:21px;font-weight:500">${escapeHtml(timestamp)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px 26px 28px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3fbfa;border-radius:18px;border:1px solid #d6eeee">
                    <tr>
                      <td style="padding:18px 18px">
                        <div style="font-size:13px;line-height:20px;color:#5b7881">Quick customer contact</div>
                        <div style="margin-top:7px;font-size:16px;line-height:24px;font-weight:800;color:#082e3b">${escapeHtml(customerPhone)}</div>
                        ${customerEmail ? `<div style="font-size:13px;line-height:20px;color:#5b7881">${escapeHtml(customerEmail)}</div>` : ''}
                      </td>
                      <td align="right" style="padding:18px 18px">
                        <a href="${callHref}" style="display:inline-block;background:#079d9d;color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 18px;font-size:13px;font-weight:800">Call customer</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 28px;background:#f8fcfc;border-top:1px solid #dceeee;color:#607f88;font-size:12px;line-height:20px">
                  <strong style="color:#082e3b">${escapeHtml(brand.name)}</strong><br>
                  ${escapeHtml(brand.address)}<br>
                  <a href="${callHref}" style="color:#07858d;text-decoration:none">${escapeHtml(brand.phone)}</a> ·
                  <a href="${mailHref}" style="color:#07858d;text-decoration:none">${escapeHtml(brand.email)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`

  return { text, html }
}

async function sendBookingEmail(event) {
  const method = event.httpMethod || event.method
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: jsonHeaders, body: '' }
  }

  if (method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405)
  }

  try {
    const payload = typeof event.json === 'function'
      ? await event.json()
      : JSON.parse(event.body || '{}')
    const { formType, fields = {} } = payload
    const config = allowedForms[formType]
    if (!config) return json({ error: 'Invalid form type.' }, 400)

    // Hidden field: bots commonly fill it, real visitors never see it.
    if (clean(fields.website)) return json({ ok: true })

    const name = clean(fields.name)
    const phone = clean(fields.phone || fields.mobile)
    const email = clean(fields.email)
    if (name.length < 2 || !/^[6-9]\d{9}$/.test(phone) || !isValidEmail(email)) {
      return json({ error: 'Please enter a valid name, 10-digit mobile number, and email address.' }, 400)
    }

    const configError = getEmailConfigError()
    if (configError) {
      console.error(configError)
      return json({ error: configError }, 503)
    }

    const transporter = await getTransporter()
    const to = process.env.MAIL_TO
    const from = clean(process.env.MAIL_FROM) || `"Jaiswalro Website" <${process.env.SMTP_USER}>`
    if (!transporter || !to || !from) {
      console.error('Email delivery provider could not be configured')
      return json({ error: 'Email service is not configured yet. Please call us.' }, 503)
    }

    const rows = config.fields
      .map(([key, label]) => [label, clean(fields[key])])
      .filter(([, value]) => value)
    const timestamp = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date())
    const { text, html } = buildEmailContent({ formType, config, fields, rows, timestamp })

    const message = {
      from,
      to,
      replyTo: email || undefined,
      subject: `${config.subject} - ${name}`,
      text,
      html,
    }
    const info = await sendMailWithTimeout(transporter, message)

    return json({ ok: true, messageId: info.messageId })
  } catch (error) {
    console.error('send-booking-email error', error)
    if (isConnectionTimeoutError(error)) {
      return json({ error: getSmtpTimeoutMessage() }, 504)
    }
    if (error.code === 'ENETUNREACH' || error.code === 'ECONNECTION' || error.code === 'ESOCKET' || error.code === 'EDNS') {
      return json({ error: 'Email server connection is unavailable. Please try again later or call us.' }, 502)
    }
    return json({ error: 'We could not process your request. Please try again.' }, 500)
  }
}

export const handler = sendBookingEmail
export default sendBookingEmail
