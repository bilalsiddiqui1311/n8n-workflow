# Property Dealer Outreach App

This is a standalone local app for property-client outreach.

Open the app, upload an Excel/CSV contact sheet, type the WhatsApp message and email message, then run a dry run or live campaign.

## Start

```bash
./scripts/start-screen-local.sh
```

Open:

```text
http://localhost:4040
```

## Contact Sheet

The first sheet is read. Recommended columns:

```text
name, phone, email, property_type, location, budget, notes
```

Only `phone` is needed for WhatsApp and only `email` is needed for email. Template fields can use any column header:

```text
Hi {{firstName}}, I saw your interest in {{property_type}} around {{location}}.
```

Built-in fields:

```text
{{name}}, {{firstName}}, {{phone}}, {{email}}
```

## WhatsApp

WhatsApp sending uses the local WhatsApp bridge. Scan the QR first:

```text
http://localhost:3001/qr
```

## Gmail

Email sending uses Gmail SMTP with an app password. Set these in `.env`:

```text
GMAIL_USER=your-gmail-address@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
GMAIL_FROM_NAME=Property Team
```

Keep `Dry Run` enabled until the preview looks right.
