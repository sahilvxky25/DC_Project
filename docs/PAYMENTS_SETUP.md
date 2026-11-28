# BitSecure payment setup and deployment

This feature keeps direct UPI QR contributions and adds Razorpay Standard Checkout, server-verified contribution records in Firestore, and Razorpay webhooks. There is no contribution dashboard in the Support Us page.

## Architecture

- Static frontend: vanilla JavaScript and Razorpay Checkout.js.
- Payment API: the existing Cloudflare Worker in `cloudflare-dns-worker/src/index.js`.
- Gateway: Razorpay Orders and Payments APIs.
- Database: Cloud Firestore collection `contributions`, written only by the Worker service account.
- Webhook idempotency: `paymentWebhookEvents`.

Direct UPI QR payments continue to go directly to the payee. They cannot be automatically confirmed by this integration and are deliberately excluded from verified Razorpay totals.

## 1. Configure the Razorpay webhook

The webhook handler already exists in the Cloudflare Worker. It is **not** a Vercel API route, so do not use `https://bitsecure-ten.vercel.app/api/...` as the webhook URL.

The deployed Worker origin configured in `js/app/support-config.js` is:

`https://dc-project-live-dns.sahilpatra274.workers.dev`

Use this exact webhook URL in Razorpay:

```text
https://dc-project-live-dns.sahilpatra274.workers.dev/api/razorpay-webhook
```

In the Razorpay Dashboard:

1. Start in **Test Mode** and open **Account & Settings → Webhooks** (the dashboard labels may vary).
2. Choose **Add New Webhook**.
3. Paste the Worker webhook URL above.
4. Generate a strong webhook secret and save it securely. You will enter the same value as the Cloudflare Worker secret `RAZORPAY_WEBHOOK_SECRET`.
5. Subscribe to exactly these events:
   - `payment.captured`
   - `payment.failed`
   - `refund.processed`
6. Save the webhook and use Razorpay's webhook test/delivery tools where available.

Do not add `order.paid`: the current Worker handles the three events listed above. Razorpay sends the event ID in `x-razorpay-event-id`; the Worker uses it for duplicate-delivery protection.

Do not use live credentials until test payments, webhook delivery, and Firestore records have been checked. Confirm that the merchant account and beneficiary are appropriate for the actual purpose of contributions and comply with Razorpay onboarding requirements.

## 2. Configure Cloudflare Worker secrets

In Cloudflare, open **Workers & Pages → dc-project-live-dns → Settings → Variables and Secrets** (or the equivalent settings panel) and add these as **secrets**, not plain-text source-code variables:

| Secret | Value |
|---|---|
| `RAZORPAY_KEY_ID` | Razorpay Test or Live Key ID |
| `RAZORPAY_KEY_SECRET` | Matching Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | The exact secret entered in the Razorpay webhook configuration |
| `FIREBASE_CLIENT_EMAIL` | Firebase service-account client email |
| `FIREBASE_PRIVATE_KEY` | Firebase service-account private key |

**Important:** Add `RAZORPAY_WEBHOOK_SECRET` to the Cloudflare Worker, not Vercel Environment Variables. The webhook request is received by the Worker domain. Keep the value out of GitHub, frontend JavaScript, and chat messages.

Add these Worker variables:

| Variable | Value |
|---|---|
| `FIREBASE_PROJECT_ID` | `bit-7ce8a` |
| `ALLOWED_ORIGINS` | `https://bitsecure-ten.vercel.app` (plus any exact preview/dev origins you intentionally need) |

The Worker accepts `ALLOWED_ORIGIN` as a backwards-compatible single-origin setting. Prefer `ALLOWED_ORIGINS` for a comma-separated allowlist. Do not set it to `*` in production. Add Cloudflare rate-limiting/WAF rules for `/api/create-order` and `/api/verify-payment` to reduce automated order creation and abuse; CORS is not an authorization or rate-limiting control.

### Firebase service account

Create a dedicated service account in Google Cloud IAM for this project, grant only the Firestore permissions needed to read/write the two payment collections (for example, an appropriately scoped Firestore role), and create a key for the Worker secret. Keep the private key out of GitHub, Vercel frontend variables, and browser code. Rotate/revoke it if exposed.

Set `FIREBASE_CLIENT_EMAIL` to the service account email and `FIREBASE_PRIVATE_KEY` to the full PEM private key. If the Cloudflare dashboard requires a single-line value, preserve newlines as literal `\\n`; the Worker converts those escaped newlines before importing the key.

## 3. Publish Firestore rules

Review and publish the repository's `firestore.rules` in Firebase Console → Firestore Database → Rules. It preserves per-user access to `users/{uid}/progress/**`, denies all browser access to `contributions` and `paymentWebhookEvents`, and defaults to deny.

The Worker uses its service account and the Firestore REST API; Firestore Security Rules do not grant browser access to payment records. Do not add client-side writes for payment status.

## 4. Connect the frontend

The Support Us frontend reads the public Worker origin from `js/app/support-config.js`. It is currently configured as:

```js
export const RAZORPAY_API_BASE_URL = 'https://dc-project-live-dns.sahilpatra274.workers.dev';
```

Keep this public Worker origin in the frontend configuration. It is not a secret. The Razorpay Key Secret, webhook secret, and Firebase service-account private key must remain in Cloudflare Worker secrets.

The Support Us page retains the existing QR, UPI ID, preset amounts and custom amount input, and adds Razorpay Checkout. Checkout payment methods shown to users depend on merchant activation and Razorpay configuration.

## 5. Test checklist

- [ ] UPI QR still scans and direct UPI intent opens with the selected amount.
- [ ] Razorpay Test Mode opens for ₹49, ₹99, ₹199, and a valid custom amount.
- [ ] ₹0, fractional, negative, non-numeric, and above-limit amounts are rejected by the Worker.
- [ ] A successful test payment becomes `captured` only after the Razorpay API confirms capture or a signed webhook arrives.
- [ ] Invalid checkout signatures are rejected.
- [ ] A payment belonging to an unknown order, wrong amount, or wrong currency is rejected.
- [ ] `payment.failed` is recorded and cannot downgrade a captured payment.
- [ ] `refund.processed` updates the contribution to `refunded`.
- [ ] Re-delivering the same webhook event does not create another contribution or duplicate event record.
- [ ] Browser clients cannot read/write contribution or webhook-event documents directly.
- [ ] Existing DNS trace endpoint and the rest of BitSecure still work.

## Data and reporting notes

- Amounts are stored in paise, as integers.
- The `contributions` document ID is the Razorpay order ID.
- Status values include `created`, `captured`, `failed`, `partially_refunded`, and `refunded`. Refund amounts are tracked in paise for accurate payment and refund reconciliation.
- Direct UPI payments are intentionally not included in server-verified Razorpay records because no payment confirmation feed is connected. Payment records are retained for backend verification and reconciliation; no contribution dashboard is exposed in the website.
- This implementation does not issue tax receipts or claim tax deductibility. Do not advertise tax benefits without confirming the legal and tax status of the receiving entity.
- Review privacy, retention, accounting, refund and payment-provider obligations before switching to Live Mode.

## Troubleshooting

- `Payment service is not configured`: verify Razorpay Worker secrets.
- `Webhook is not configured`: add `RAZORPAY_WEBHOOK_SECRET` to the Cloudflare Worker and confirm it exactly matches the Razorpay webhook secret.
- `Invalid webhook signature`: check for whitespace/character differences and ensure the webhook secret belongs to the same Razorpay mode (Test or Live) as the webhook.
- `Firebase service account secrets are not configured`: add the service account email and PEM key as Cloudflare secrets.
- `Unable to obtain Firebase service access token`: check the service-account key format, IAM permissions and project.
- Checkout doesn't open: confirm the Worker endpoint in `support-config.js`, the Worker origin allowlist, and that Razorpay Checkout.js can load.
- Payment says pending/not captured: check Razorpay capture settings and webhook delivery logs; do not ask the user to pay again until the original payment is reconciled.
