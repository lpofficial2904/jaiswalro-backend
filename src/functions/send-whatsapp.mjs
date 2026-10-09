const allowedForms = {
  contact: {
    title: 'CONTACT FORM',
    fields: [['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['subject', 'Enquiry type'], ['message', 'Message']],
  },
  product: {
    title: 'PRODUCT BOOKING',
    fields: [['product', 'Product'], ['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['location', 'Location'], ['pincode', 'Pincode'], ['message', 'Requirement']],
  },
  service: {
    title: 'SERVICE BOOKING',
    fields: [['service', 'Service'], ['plan', 'Plan'], ['price', 'Price'], ['name', 'Name'], ['mobile', 'Mobile'], ['location', 'Location'], ['flatNumber', 'Flat / House'], ['street', 'Street'], ['area', 'Area'], ['pincode', 'Pincode'], ['preferredDate', 'Preferred date'], ['problem', 'RO problem / notes']],
  },
}

const clean = value => String(value ?? '').trim().slice(0, 1000)

export default async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'POST' } })
  }

  try {
    const { formType, fields = {} } = await request.json()
    const config = allowedForms[formType]
    if (!config) return Response.json({ error: 'Invalid form type.' }, { status: 400 })

    // Hidden field: bots commonly fill it, real visitors never see it.
    if (clean(fields.website)) return Response.json({ ok: true })

    const name = clean(fields.name)
    const phone = clean(fields.phone || fields.mobile)
    if (name.length < 2 || !/^[6-9]\d{9}$/.test(phone)) {
      return Response.json({ error: 'Valid name aur 10-digit mobile number required hai.' }, { status: 400 })
    }

    const token = process.env.WHATSAPP_ACCESS_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const recipient = (process.env.WHATSAPP_TO_NUMBER || '').replace(/\D/g, '')
    if (!token || !phoneNumberId || !recipient) {
      console.error('Missing WhatsApp environment variables')
      return Response.json({ error: 'WhatsApp service abhi configure nahi hai. Please call us.' }, { status: 503 })
    }

    const lines = config.fields
      .map(([key, label]) => [label, clean(fields[key])])
      .filter(([, value]) => value)
      .map(([label, value]) => `*${label}:* ${value}`)
    const timestamp = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date())
    const message = `*NEW ${config.title}*\n\n${lines.join('\n')}\n\n*Received:* ${timestamp}`
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v23.0'
    const whatsappResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: { preview_url: false, body: message },
      }),
    })
    const whatsappResult = await whatsappResponse.json()
    if (!whatsappResponse.ok) {
      console.error('WhatsApp API error', JSON.stringify(whatsappResult))
      return Response.json({ error: 'WhatsApp par request send nahi hui. Please dobara try karein.' }, { status: 502 })
    }

    return Response.json({ ok: true, messageId: whatsappResult.messages?.[0]?.id })
  } catch (error) {
    console.error('send-whatsapp error', error)
    return Response.json({ error: 'Request process nahi ho saki. Please dobara try karein.' }, { status: 500 })
  }
}

