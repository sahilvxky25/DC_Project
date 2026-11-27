# BitSecure — Data Communications Lab

BitSecure is an interactive, browser-based learning platform for Data Communications and Computer Networks. It combines structured lessons with hands-on protocol labs, visual simulations, quizzes, and progress tracking. Learners can follow data from an application message through packetization and transmission, inspect networking concepts layer by layer, and experiment with errors, security, routing, and network behaviour.

> **Educational scope:** Most networking activities are browser-based simulations. They do not configure the learner's operating system, change a real firewall/router, or transmit simulated packets across the public internet. The optional local network inventory helper is read-only and has separate setup requirements.

## What you can explore

### End-to-end data transmission
- Follow the sender-to-receiver journey: message input, encoding, packetization, link transmission, and reconstruction.
- Send **text, images, videos, documents, and audio files** through the core lab.
- Inspect bytes, packet headers, payloads, checksums, delivery order, acknowledgements, retries, and reassembly.
- Experiment with packet loss, bit corruption, delivery order, retry limits, and transmission speed.
- Receive visible validation feedback for unsupported formats and files over the configured size limit.

### Link layer and reliable delivery
- Learn framing, byte stuffing, bit stuffing, and line coding.
- Compare parity, Internet checksum, CRC-8, and CRC-32 error detection.
- Explore SECDED Hamming code, two-dimensional parity, and Reed–Solomon coding with error injection and correction demonstrations.
- Simulate Stop-and-Wait and Sliding Window ARQ, including acknowledgements, timeouts, and retransmissions.

### Network layer
- Practise IPv4 addressing, subnet calculations, IP headers, and routing decisions.
- Build and explore network topologies.
- Experiment with the Wi-Fi simulator: access points, clients, SSID, band, channel, signal coverage, simplified interference, and obstacles.
- Optionally inspect OS-reported network interfaces, default routes, neighbour cache, and the current Wi-Fi connection through the local network inventory helper.

### Transport layer
- Compare TCP and UDP, transport headers, and ports.
- Step through the TCP handshake.
- Explore congestion control, congestion-window behaviour, duplicate ACKs, and timeout scenarios.
- Learn about sockets and multiplexing.
- Use the Network Performance Analyzer to estimate transfer time, throughput, delivery ratio, and retransmissions from configurable network parameters.

### Application layer and security
- Visualize DNS resolution and caching; a separate live iterative DNS option can use a hosted resolver worker.
- Explore HTTP requests, responses, methods, status codes, and TLS handshake concepts.
- Use encryption/decryption demonstrations for Caesar and XOR teaching ciphers, AES-256-GCM, RSA-OAEP with AES-GCM hybrid encryption, ECDH P-256 key agreement with AES-GCM, and SHA-256 hashing.
- Inspect intermediate processing stages and receiver-side results in supported demonstrations.

**Cryptography note:** Caesar and XOR are intentionally insecure teaching examples. SHA-256 is a one-way hash, not encryption. Browser demonstrations are for learning and should not replace vetted protocols and libraries in production applications.

### Advanced labs and learning resources
- Study encapsulation and decapsulation across networking layers.
- Inspect packet captures and practise display filtering.
- Work through guided troubleshooting exercises.
- Create ordered packet-filtering rules in the Firewall and Access Control Lab, test sample traffic, and inspect first-match decisions and rule-order effects.
- Use the searchable Network Protocol Comparison Lab, including an interactive OSI and TCP/IP layer mapping.
- Explore tutorials, challenges, quizzes, glossary entries, achievements, and the guided learning journey.

## Learning experience and account features

- **Learning dashboard:** browse modules by learning group and filter the module catalogue.
- **Bookmarks:** save modules and return to them from the primary navigation.
- **Recently viewed:** revisit recent modules and open the full learning-history view.
- **Recently searched:** access recent search queries from the module search interface.
- **Mistake Notebook:** automatically collect incorrect quiz answers so learners can review weak topics.
- **Quick Revision:** concise, short-note-style revision points are available at the end of supported learning modules.
- **Manual completion:** mark a module as completed independently of quiz completion.
- **Estimated duration:** module cards and learning views display approximate completion times where configured.
- **Table of Contents:** browse the site's main pages and learning destinations from one place.
- **Guided OSI layer journey:** explore networking layers through an interactive learning flow.
- **Responsive interface:** collapsible desktop navigation, mobile navigation drawer, and persistent light/dark theme.

### Accounts and progress
Firebase Authentication supports email/password sign-up and sign-in, Google sign-in when configured, email verification, password reset, password change, and sign-out. Cloud Firestore synchronizes account-specific learning progress and supported learning data, including quiz statistics, achievements, run history, notes, theme, and last-visited information. A local account-specific cache helps preserve progress when cloud access is temporarily unavailable.

### Daily quizzes and weekly leagues
- The daily quiz selects five questions from the registered module-question bank and changes its selection each UTC day.
- A daily attempt is recorded once per learner per day and awards XP based on the score.
- Weekly competition uses Bronze, Silver, Gold, Platinum, and Diamond tiers, with batches designed for up to 20 learners.
- Weekly XP, lifetime XP, module quiz rewards, daily quiz rewards, promotions/demotions, and profile decorations are tracked separately by the feature logic.

**Competition security limitation:** the browser implementation submits XP events directly to Firestore. Per-user member documents help isolate writes, but a determined user can still forge their own score through the Firestore API. Do not use these scores for prizes, paid benefits, or trusted rankings until quiz attempts and score awards are validated by a trusted backend (for example, a Firebase Cloud Function or an existing server API). Client-side Firestore rules are not a substitute for server-side validation. The client also computes weekly promotion/demotion when a learner returns in the new UTC week; production competition should use a trusted scheduled settlement process.

### Optional local network inventory helper
The helper under `tools/network-agent/` is a separate Python 3.9+ process bound to `127.0.0.1`. The browser module is read-only and works only while the helper is running. It reports OS-provided interface, route, neighbour-cache, and Wi-Fi information. It does not perform host discovery, ping, port scanning, packet capture, or network configuration changes. Neighbour-cache entries are not a complete device inventory or physical topology. See [tools/network-agent/README.md](tools/network-agent/README.md).

## Technology

- HTML, CSS, and vanilla JavaScript using native ES modules.
- Firebase Authentication and Cloud Firestore for account and progress features.
- Browser Web Crypto API for supported cryptography demonstrations.
- Browser storage for local preferences and cached learning progress.
- Optional Python 3.9+ local helper for read-only network inventory.
- Hosted DNS resolver worker for the optional live iterative DNS mode.

## Requirements

- A modern browser with JavaScript ES module support.
- The Web Crypto API for supported cryptography demonstrations.
- Python 3 or another local static HTTP server.
- A Firebase project with Authentication and Cloud Firestore configured for account-based features.
- Optional: Python 3.9+ for the local network inventory helper; a deployed resolver worker for live iterative DNS.

## Run locally

1. Clone the repository and open a terminal in the project root.
2. Start a local static server:

   ```bash
   python3 -m http.server 8000
   ```

3. Open [http://localhost:8000](http://localhost:8000).

You can also use VS Code Live Server or `npx serve`.

**Do not open `index.html` directly with `file://`.** The application uses JavaScript ES modules, which browsers generally block when loaded from a local file URL.

## Firebase setup

### Authentication
1. Create or select a project in the [Firebase console](https://console.firebase.google.com/).
2. Register a Firebase Web app and copy its web-app configuration.
3. In **Authentication → Sign-in method**, enable Email/Password and enable Google if Google sign-in is required.
4. In **Authentication → Settings → Authorized domains**, add the hostnames used for local and deployed versions (hostnames only; no URL paths).
5. Configure the web app in `js/auth/firebase-client.js`.
6. Run the site over HTTP(S) and test sign-up, verification, sign-in, password reset/change, Google sign-in (if enabled), and sign-out.

### Cloud Firestore progress
The main progress document is stored at:

```text
users/{uid}/progress/overview
```

Create a Cloud Firestore database and publish rules that restrict each account to its own UID path. A basic ownership pattern is:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

This is an ownership example, not a complete production ruleset for every feature. Review the league paths and their stricter validation requirements separately; never enable broad test-mode rules in production.

Then sign in, visit modules, complete a quiz, and allow time for the debounced cloud write. Confirm the progress document in Firestore, then sign in with the same account on another device to verify restoration. Test a second account to confirm isolation.

**Existing local progress:** the legacy `dcl.v2` localStorage key is not automatically assigned to a signed-in account because it has no Firebase UID. The account-specific cache uses `dcl.v2.user.{uid}`.

**Security:** Firebase web configuration is delivered to the browser and is not a server-side secret. Never place service-account private keys, Admin SDK credentials, or other server secrets in client code or commit them to Git. Use Firebase Security Rules for access control and trusted server-side validation for data that must be tamper-resistant.

## Project structure

```text
.
├── index.html
├── assets/                    Images and other static assets
├── css/                       Base, layout, component, lab, module and feature styles
├── docs/                      Project and AI knowledge-base documentation
├── tools/network-agent/       Optional local network inventory helper
└── js/
    ├── app.js                 Application entry point and module imports
    ├── auth/                  Firebase client and account flows
    ├── core/                  Shared state, storage, encoding and UI helpers
    ├── simulations/           Protocol, error-control and network models
    ├── app/                   Routing, navigation, search, progress and feature views
    ├── game/                  Learning zones, quizzes, XP and game-style UI
    ├── lab/                   End-to-end transmission stages
    └── modules/
        ├── registry.js        Module groups and core-lab stage registry
        ├── link-layer/
        ├── network-layer/
        ├── transport-layer/
        ├── application-layer/
        ├── advanced/
        └── learning/
```

### Application architecture
- `index.html` loads `js/app.js` as a JavaScript ES module and loads stylesheets in an intentional cascade order.
- `js/app.js` imports learning modules; each module registers itself through `regMod()` in `js/modules/registry.js`.
- The registry defines seven learning groups and four core-lab stages. The router displays selected modules using URL hashes (for example, `#/m/http`).
- Module interfaces live in `js/modules/`; reusable protocol and network models live in `js/simulations/`; shared helpers live in `js/core/`.
- The core transmission workflow is initialized from `js/lab/`.
- Account and cloud-progress functionality lives in `js/auth/` and related progress helpers in `js/app/`.
- Game-style learning flow, quiz metadata, XP rules, and screens live in `js/game/`.

### Add a learning module
1. Create a file under the appropriate `js/modules/<area>/` directory.
2. Import `regMod` from `../registry.js` and register a module with an `id`, `group`, `title`, `desc`, and `mount(root)`.
3. Import the new module file in `js/app.js` so it registers at startup.
4. Add or update quiz metadata when the module participates in the game-style learning flow.
5. Test navigation into and out of the module. If it creates timers or external event listeners, return a cleanup function from `mount(root)`.

### Common change locations

| Task | Location |
| --- | --- |
| Change a module's UI or interactions | `js/modules/<area>/<module>.js` |
| Change protocol or simulation logic | `js/simulations/<topic>.js` |
| Change the core transmission workflow | `js/lab/` and related simulation files |
| Change module groups or ordering | `js/modules/registry.js` and imports in `js/app.js` |
| Change colours, typography, or theme tokens | `css/tokens.css` |
| Change shared controls and component styles | `css/components.css` |
| Change sign-in and account flows | `js/auth/` |
| Change Firebase initialization | `js/auth/firebase-client.js` |
| Change bookmarks, recently viewed, mistakes, or search history | `js/app/` and `js/core/` |
| Change quizzes, XP, leagues, or learning screens | `js/game/` and `js/modules/learning/` |

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Blank page or CORS/module errors | Start a local HTTP server; do not use `file://`. |
| A JavaScript file returns 404 | Check import paths and file names; relative imports must point to the correct `.js` file. |
| “does not provide an export named …” | Confirm that the export exists and the import name/path matches. |
| Sign-in says the domain is unauthorized | Add the hostname in Firebase Authentication → Settings → Authorized domains. |
| Email/password sign-in is unavailable | Enable Email/Password in Firebase Authentication → Sign-in method. |
| Firestore `permission-denied` | Verify the signed-in UID and the rules for the exact document path being accessed. |
| Progress differs between devices | Confirm both devices use the same Firebase project and account, then inspect `users/{uid}/progress/overview`. |
| Old progress appears during testing | Check the account-specific `dcl.v2.user.{uid}` cache and Firestore document. The legacy global cache is not automatically imported. |
| Cryptography features are unavailable | Use HTTPS or localhost and a browser that supports the Web Crypto API. |
| Live iterative DNS does not respond | Check the configured resolver worker URL, deployment status, and browser network/CORS errors. The simulated DNS lesson is separate. |
| Local network inventory is unavailable | Start the optional helper and check its setup instructions and localhost endpoint. |
| CSS changes do not appear | Hard-refresh the page to bypass cached stylesheets. |

## Manual smoke-test checklist

Before publishing a change, test the affected feature and the main application flow:

1. Start the local server and confirm the page loads without console errors.
2. Visit each sidebar group and test browser Back/Forward navigation and direct module links.
3. In the core lab, try text and each supported file type, packet-size changes, packet loss, corruption, retries, and stopping a transmission.
4. In Error Detection & Correction, test detection methods and Hamming, two-dimensional parity, and Reed–Solomon examples.
5. Exercise TCP/UDP, handshake, congestion control, sockets, subnetting, routing, DNS, HTTP/TLS, and encryption demonstrations.
6. In topology and Wi-Fi simulators, add, edit, and remove elements and verify that displayed results update.
7. In the firewall lab, add and reorder rules, test packets, and compare policy results.
8. Test bookmarks, recently viewed, recent search suggestions, Mistake Notebook, Quick Revision, manual completion, and the Table of Contents.
9. Switch the theme, reload, and confirm it persists. Test desktop sidebar and mobile navigation.
10. Sign in and confirm Firestore progress loads before the learning interface opens.
11. Visit modules and finish a quiz; verify progress syncs and restores on another device.
12. Sign out, sign in as a different user, and confirm the first user's progress is not shown or uploaded to the second account.
13. Test offline behaviour; local changes should remain cached, and a failed cloud read must not trigger a blind overwrite.

## Simulation limitations

- The Network Performance Analyzer uses a simplified, seeded model. Its outputs are estimates from selected parameters; it does not measure the live internet connection or transmit real packets.
- The Wi-Fi simulator uses simplified signal and interference scores. These are educational approximations, not dBm measurements, live scans, or predictions of actual throughput. Security options are labels in the simulation and do not configure or encrypt a real wireless network.
- The firewall lab evaluates sample packets against an in-browser stateless rule set. It does not modify the device or network firewall and does not track real connections.
- HTTP, DNS, routing, and other network scenarios are educational models, except the separately hosted live iterative DNS lookup option.
- The local network inventory helper reports operating-system-provided information only; it is not a scanner or complete network discovery tool.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, project conventions, testing expectations, and pull request guidelines.

## Security

If you discover a security vulnerability, please report it privately and do not disclose it in a public issue or pull request. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

## Privacy

The in-app Privacy Policy is available from the site footer at `#/privacy`. It describes account and learning-progress data, Firebase/Google services, browser storage, cookie preferences, and privacy-request limitations. Keep it synchronized with actual data practices whenever features or integrations change. Before public launch, provide a monitored privacy contact and implement/verify the account and data deletion process described to users.

## Support Us

The Support Us page currently accepts **direct UPI contributions**. The QR code is stored at `assets/sahil-upi-qr.svg`; the displayed UPI ID is `8598032563@slc` (payee: Mr Sahil Kumar Patra). Card payments and other payment options are marked **Coming Soon**. Razorpay checkout has been temporarily removed from the frontend; retained Cloudflare Worker API routes are not called by the current Support Us page.

Direct UPI payments take place outside BitSecure. The site does not automatically receive or verify payment confirmations, so it must not display a payment as successful or issue a verified receipt based only on a user statement or screenshot. Confirm transactions independently in the receiving UPI/bank account.
