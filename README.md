# Jaiswalro backend

Standalone Node.js API for the website's booking email and WhatsApp form
submissions. The frontend is in `../Frontend`.

## Requirements

- Node.js 20.6 or newer
- SMTP account for Nodemailer
- Meta WhatsApp Cloud API credentials for WhatsApp notifications

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Set the credentials in `.env` before testing the notification endpoints.
Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
`MAIL_FROM`, and `MAIL_TO`. For Gmail, `SMTP_PASS` must be a Google App
Password, not the normal Gmail login password. The server listens on port
`3001` by default; set `PORT` to change it.

## Email setup

The email endpoint sends through Nodemailer SMTP. For Render free services,
use an SMTP relay that supports port `2525`. Example SendGrid settings:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
MAIL_FROM="Jaiswalro Website <your_verified_sender_email>"
MAIL_TO=lpofficial2904@gmail.com
```

For SendGrid, `SMTP_USER` must be exactly `apikey`, and `SMTP_PASS` must be a
SendGrid API key with Mail Send permission. `MAIL_FROM` must be verified in
SendGrid sender authentication. If the backend host blocks outbound SMTP ports,
Nodemailer cannot deliver through that blocked host/port.

## Endpoints

- `GET /health` — process health check
- `POST /api/forms/email` — booking/contact email
- `POST /api/forms/whatsapp` — WhatsApp Cloud API notification

Both POST endpoints accept JSON with `formType` (`contact`, `product`, or
`service`) and a `fields` object. Browser origins must be listed in
`CORS_ORIGINS`, a comma-separated list of full origins such as
`https://brilliant-sprinkles-167aa2.netlify.app`,
`https://jaiswal-ro.vercel.app`, `https://jaiswalro.services`, and
`https://www.jaiswalro.services`.
