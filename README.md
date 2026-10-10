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

The email endpoint sends through Nodemailer SMTP. Example Gmail settings:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=jaiswalroservices@gmail.com
SMTP_PASS=your_gmail_app_password
MAIL_FROM="Jaiswalro Website <jaiswalroservices@gmail.com>"
MAIL_TO=jaiswalroservices@gmail.com
```

If the backend host blocks outbound SMTP ports, Nodemailer cannot deliver from
that host. Use a host that permits SMTP or an SMTP relay/port allowed by the
host. On hosts where Gmail SMTP times out, use an SMTP relay that supports a
non-blocked port such as `2525`, then set `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS` from that relay.

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
