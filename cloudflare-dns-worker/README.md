# DC_Project live iterative DNS service

This hosted Cloudflare Worker performs real iterative DNS lookups. It starts at a DNS root server, follows TLD referrals, follows authoritative referrals, and returns actual response records and TTLs.

## Does a learner need Python or local software?

No. Learners open DC_Project, select Application Layer > DNS > Live iterative DNS, enter a domain, and click Run real lookup. No Python, terminal, local agent, or local server is required on their device.

The Worker is a hosted service and must be deployed once by the project owner. The static frontend calls its HTTPS endpoint.

## Deploy once using the Cloudflare dashboard

1. Sign in to Cloudflare and open Workers & Pages.
2. Create a Worker named dc-project-live-dns.
3. Open its code editor and replace the starter code with the complete contents of src/index.js from this folder.
4. Deploy the Worker.
5. The existing BitSecure Worker URL is `https://dc-project-live-dns.sahilpatra274.workers.dev`.
6. Open DC_Project > Application Layer > DNS > Live iterative DNS.
7. Paste that URL into Hosted resolver URL and run a lookup such as google.com with record type A.

The Worker exposes GET /health and GET /trace?name=google.com&type=A. It uses Cloudflare outbound TCP sockets to contact DNS servers on TCP port 53. Documentation: https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/.

## Razorpay + Firestore contribution API

The same Worker now exposes:

- `POST /api/create-order`: creates a Razorpay INR order and stores an initial `created` contribution record in Firestore. Request amount is integer paise; accepted range is ₹1–₹1,00,000.
- `POST /api/verify-payment`: verifies the Razorpay checkout HMAC signature, confirms the order was created by BitSecure, fetches the payment from Razorpay, checks order ID/amount/currency and requires `captured` status before marking the contribution captured.
- `POST /api/razorpay-webhook`: verifies the webhook HMAC against the raw request body and handles `payment.captured`, `payment.failed`, and `refund.processed`. Event IDs are stored for duplicate delivery protection. A failed event cannot downgrade an already captured contribution.

### Required Cloudflare Worker secrets

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Required Worker variables

- `FIREBASE_PROJECT_ID=bit-7ce8a`
- `ALLOWED_ORIGINS=https://bitsecure-ten.vercel.app`

Use the exact deployed site origin(s); do not use a wildcard in production. Keep service-account private keys and Razorpay secrets in Cloudflare secrets, never in the frontend or repository. Publish the root `firestore.rules` file so browser clients cannot access the contribution collections.

The Support Us frontend reads the public Worker origin from `js/app/support-config.js`. The UPI QR remains available alongside Razorpay Checkout. Direct QR payments are not automatically confirmed by BitSecure. The Support Us page does not expose a contribution dashboard; Firestore records are retained for backend payment verification and reconciliation.

For Firebase service-account permissions, Razorpay webhook setup, test checklist and production cutover steps, follow [docs/PAYMENTS_SETUP.md](../docs/PAYMENTS_SETUP.md).

## Important notes

- The existing simulated DNS lookup, cache clock, recursive/iterative teaching mode, message-byte explorer and record-type guide remain available.
- Live mode shows actual DNS referrals and returned records. It does not fabricate root/TLD/authoritative steps from a recursive DoH answer.
- DNS infrastructure or hosting network policies can cause individual traces to fail. The interface displays the returned error.
- The endpoint is public and intended for a learning project. Before production use, add rate limiting and an origin allowlist, and monitor Worker usage.
