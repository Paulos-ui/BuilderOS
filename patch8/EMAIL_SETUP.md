# Sending real sign-in emails

## Step 1 — Resend account and API key

1. Sign up at <https://resend.com> (free tier is fine for a demo).
2. Go to **API Keys** → **Create API Key**. Give it send permission.
3. Copy the key — it starts `re_` and is shown once.

## Step 2 — Configure locally

```bash
cd "/mnt/c/Users/MY PC/Desktop/builderos/apps/api"

cat >> .env << 'ENV'
RESEND_API_KEY=re_your_key_here
MAIL_FROM=onboarding@resend.dev
ENV

npm run start:dev
```

The API now prints on startup:

```
Email delivery: ENABLED (from onboarding@resend.dev)
```

If it says DISABLED, the key didn't load — check for typos or stray quotes.

## Step 3 — Test with YOUR OWN email address

This is the part that catches everyone:

> Until you verify a sending domain, Resend only lets you send to the email
> address you registered the account with.

So test with that address. Anything else gets rejected — and the API will now
tell you exactly why rather than throwing a generic error.

```bash
curl -X POST http://localhost:4000/v1/auth/email/otp \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_RESEND_ACCOUNT_EMAIL@example.com"}'
```

Expected:

```json
{"sent":true,"delivery":"sent","retryAfter":30}
```

Check your inbox — and your spam folder, since `onboarding@resend.dev` is a
shared sender with no reputation tied to you.

If you see `"delivery":"failed"` the response includes a `reason` explaining
what to fix, and the code is still printed in the API log so you can carry on.

## Step 4 — Send to anyone (verify a domain)

To email real users you need a domain you control.

1. In Resend, go to **Domains** → **Add Domain**.
2. Enter your domain (e.g. `builderos.dev`).
3. Resend gives you DNS records — typically SPF, DKIM, and sometimes a
   return-path record. Add them at your registrar.
4. Wait for verification. DNS propagation is usually minutes but can take
   hours.
5. Update the sender:

```
MAIL_FROM=hello@builderos.dev
```

You cannot skip this. Sending as a domain you don't control is what spam
filters exist to stop.

## Step 5 — Production (Render)

Add the same two variables in Render → your service → Environment:

```
RESEND_API_KEY   re_your_key_here
MAIL_FROM        onboarding@resend.dev   (or your verified sender)
```

Render redeploys automatically. Confirm in the logs that startup reports
`Email delivery: ENABLED`.

## For the demo

If the domain isn't verified in time, **lead with wallet sign-in**. It has no
external dependency: connect, sign, in. Then show the email path using your
own Resend account address as a second example.

Don't demo email to an arbitrary address on an unverified domain — it will
fail, and it will look like the product is broken when it's actually a DNS
step you haven't finished.

## Troubleshooting

**`delivery: "logged"`** — `RESEND_API_KEY` isn't set. The code is in the API
log.

**`delivery: "failed"` with a domain message** — you're emailing an address
other than your Resend account owner, on an unverified domain. Either test
with the owner address or finish Step 4.

**Email sent but never arrives** — check spam. Shared senders like
`onboarding@resend.dev` have no domain reputation. A verified domain fixes
deliverability properly.

**Rate limited** — free tiers cap daily sends. Check Resend's current limits;
they change.
