# Jaiswalro backend

Standalone Node.js API for the website's booking email and WhatsApp form
submissions. The frontend is in `../Frontend`.

## Requirements

- Node.js 20.6 or newer
- Resend API key and verified sender domain, or an SMTP account on a host that permits outbound SMTP
- Meta WhatsApp Cloud API credentials for WhatsApp notifications

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Set the credentials in `.env` before testing the notification endpoints.
`RESEND_API_KEY` enables HTTPS email delivery and takes precedence over SMTP.
Configure `MAIL_FROM` with a sender on a domain verified in Resend and set
`MAIL_TO` to the inbox that receives enquiries. SMTP is only used when no
Resend key is configured; Render Free blocks outbound SMTP ports. The server
listens on port `3001` by default; set `PORT` to change it.

## Email setup on Render

Render Free blocks SMTP ports `25`, `465`, and `587`. To deliver email from a
free Render service:

1. Create a Resend account and verify the domain used for sending.
2. Create a Resend API key with permission to send email.
3. In Render's backend environment settings, set `RESEND_API_KEY`,
   `MAIL_FROM` (an address on the verified domain), and `MAIL_TO`.
4. Redeploy the backend. Do not add the API key to the frontend or commit it.

## Endpoints

- `GET /health` — process health check
- `POST /api/forms/email` — booking/contact email
- `POST /api/forms/whatsapp` — WhatsApp Cloud API notification

Both POST endpoints accept JSON with `formType` (`contact`, `product`, or
`service`) and a `fields` object. Browser origins must be listed in
`CORS_ORIGINS`, a comma-separated list of full origins.
