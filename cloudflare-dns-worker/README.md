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
5. Copy its workers.dev HTTPS URL.
6. Open DC_Project > Application Layer > DNS > Live iterative DNS.
7. Paste that URL into Hosted resolver URL and run a lookup such as google.com with record type A.

The Worker exposes GET /health and GET /trace?name=google.com&type=A. It uses Cloudflare outbound TCP sockets to contact DNS servers on TCP port 53. Documentation: https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/.

## Optional deployment with Wrangler

If you prefer deploying from a development machine, install Node.js and run:

    cd cloudflare-dns-worker
    npx wrangler deploy

This is an owner/developer deployment step only. It is not required for learners using the website.

## Razorpay Standard Checkout API

This same Worker also exposes two payment routes for the BitSecure Support Us page:

- `POST /api/create-order` with JSON `{"amount": 9900}` (amount in paise) creates an INR Razorpay order. The minimum is 100 paise.
- `POST /api/verify-payment` with `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` verifies the HMAC-SHA256 signature.

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` as Worker secrets (not plain-text config). Set `ALLOWED_ORIGIN` as a Worker variable to the exact website origin. For local development, copy `.dev.vars.example` to `.dev.vars`; never commit the local file. Use Test Mode credentials first. Deployment steps and frontend configuration are documented in the repository README.

The signature endpoint verifies the response signature only. Before using payment state for accounting, donor totals, or receipts, reconcile payment capture status through a signed webhook or Razorpay's server API.

## Important notes

- The existing simulated DNS lookup, cache clock, recursive/iterative teaching mode, message-byte explorer and record-type guide remain available.
- Live mode shows actual DNS referrals and returned records. It does not fabricate root/TLD/authoritative steps from a recursive DoH answer.
- DNS infrastructure or hosting network policies can cause individual traces to fail. The interface displays the returned error.
- The endpoint is public and intended for a learning project. Before production use, add rate limiting and an origin allowlist, and monitor Worker usage.
