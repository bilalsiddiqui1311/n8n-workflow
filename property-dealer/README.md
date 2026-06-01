# Property Dealer Contact Outreach

This branch adds an n8n workflow for property-client outreach.

## Contact File

Put the contact workbook at:

```text
property-dealer/contacts.xlsx
```

The workflow reads the first sheet. Recommended columns:

```text
name, phone, email, property_type, location, budget, notes, whatsapp_message, email_subject, email_body, send_whatsapp, send_email
```

Only `name`, `phone`, and/or `email` are required. The workflow will generate a default WhatsApp message and email if the custom message columns are empty.

Use `send_whatsapp` or `send_email` with `no`, `false`, `0`, or `skip` to disable a channel for a row.

## n8n Credentials

Before running the Gmail branch, open the `Property Dealer Excel Outreach` workflow in n8n and attach your Gmail OAuth2 credential to the Gmail node.

WhatsApp sending uses the local WhatsApp bridge `/send` endpoint. You must scan the WhatsApp QR first:

```text
http://localhost:3001/qr
```

## Import

```bash
./scripts/import-property-dealer-workflow-host.sh
```

Then run the workflow manually from n8n.
