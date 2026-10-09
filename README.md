# Jaiswalro backend

Standalone Node.js API for the website's booking email and WhatsApp form
submissions. The frontend is in `../Frontend`.

## Requirements

- Node.js 20.6 or newer
- SMTP account for booking email notifications
- Meta WhatsApp Cloud API credentials for WhatsApp notifications

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Set the credentials in `.env` before testing the notification endpoints. The
server listens on port `3001` by default; set `PORT` to change it.

## Endpoints

- `GET /health` — process health check
- `POST /api/forms/email` — booking/contact email
- `POST /api/forms/whatsapp` — WhatsApp Cloud API notification

Both POST endpoints accept JSON with `formType` (`contact`, `product`, or
`service`) and a `fields` object. Browser origins must be listed in
`CORS_ORIGINS`, a comma-separated list of full origins.
