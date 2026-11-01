# BitSecure — Data Communications Lab

BitSecure is an interactive, browser-based data communications and networking learning lab. Explore how a message moves through network layers, inspect protocol headers, simulate network behaviour, and practise with guided modules and challenges.

## Features

- **Core end-to-end lab:** follow text through UTF-8 bytes, packetization, transmission over a simulated lossy link, retries, reassembly, and decoding.
- **Link layer:** framing and stuffing, error detection, Stop-and-Wait, and sliding-window ARQ.
- **Network layer:** IPv4/subnet practice, IP headers, routing, a visual Network Topology Builder, and a Wi-Fi and Wireless Networking Simulator with SSID/band/channel settings, coverage, simplified interference, obstacles, and Ethernet comparison.
- **Transport layer:** TCP/UDP comparisons and header building, handshake steps, congestion control, sockets, and a Network Performance Analyzer for estimated transfer time, throughput, delivery ratio, and retransmissions.
- **Application layer:** DNS resolution and caching, an HTTP Status Code Explorer based on the IANA registry, HTTP request/response simulations, and TLS handshake/encryption demonstrations.
- **Advanced topics:** encapsulation, packet capture and display filters, and a Troubleshooting Lab with simulated cases plus an optional local command agent for real ping/traceroute/DNS and interface/routing diagnostics.
- **Learning tools:** tutorials, challenges/quizzes, glossary, searchable Network Protocol Comparison Lab, progress indicators, achievements, and theme selection.
- **Accounts:** Firebase Authentication email/password sign-up and sign-in, password-reset email, email verification, profile menu, password change, and sign-out.
- **Cloud progress:** Firestore synchronization of existing saved progress, achievements, run history, quiz statistics, notes, theme, and last visited screen for the signed-in account.
- **Responsive interface:** desktop sidebar controls and a mobile navigation drawer.

The Network Performance Analyzer uses a seeded, stop-and-wait model with configurable bandwidth, round-trip time, packet loss, packet size, packet count, and retry limits. Its outputs are estimates only; it does not measure the live internet connection or send real packets.

Most networking demonstrations are simulations intended for learning; the HTTP server and network scenarios shown in the modules are not real remote services. The Troubleshooting Lab is simulation-only by default. Its optional Real diagnostics mode runs a strict allowlist of local OS commands only when you separately start the local agent described in `agent/README.md`.

## Requirements

- A modern browser with JavaScript modules and the Web Crypto API (for the cryptography demonstration).
- Python 3 or another local static HTTP server.
- Python 3.9+ only if you want to use the optional local networking command agent (`agent/local_agent.py`).
- A Firebase project with Authentication and Cloud Firestore configured.

## Run locally

From the repository root, start a static server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/> in your browser.

You can also use a static server such as VS Code Live Server or `npx serve`.

**Do not open `index.html` directly with `file://`.** The application uses JavaScript ES modules, which browsers generally block when loaded from a local file URL.

## Firebase Authentication setup

The sign-in and account features use Firebase Authentication from the browser.

1. Create or select a project in the [Firebase console](https://console.firebase.google.com/).
2. Register a Web app in the Firebase project and copy its web-app configuration.
3. In **Authentication → Sign-in method**, enable **Email/Password**.
4. In **Authentication → Settings → Authorized domains**, add the local and deployed hostnames you use. Do not include URL paths.
5. Update the configuration in `js/auth/firebase-client.js` to match the Firebase Web app.
6. Run the app through a local HTTP server and test sign-up, sign-in, email verification, password reset, password change, and sign-out.

## Firebase Cloud Firestore progress setup

The application synchronizes each signed-in user's existing progress state to Firestore. It uses the path `users/{uid}/progress/overview`, where `{uid}` is the Firebase Authentication UID. The app reads the cloud document before showing the learning interface, merges it with that user's local cache, and debounces subsequent writes. Progress remains cached locally if a cloud request fails; a cloud read must succeed before this client uploads a merged snapshot.

1. In the [Firebase console](https://console.firebase.google.com/), open **Build → Firestore Database** and create a database if one does not already exist.
2. Open the **Rules** tab and publish rules that restrict reads and writes to the signed-in user’s own UID path. For example:

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

3. Confirm the project's Firebase web configuration in `js/auth/firebase-client.js` and deploy the site over HTTP(S).
4. Sign in with a verified account, visit a few modules, complete a quiz, and wait briefly for the debounced cloud write.
5. In Firestore's **Data** tab, confirm that a document appears at `users/{your-auth-uid}/progress/overview`.
6. Sign in with that same account on another browser/device and verify that the visited screens, achievements, statistics, and last visited screen are restored. Then sign out and sign in as a different account to verify the progress is isolated.

**Existing local progress note:** progress in the old `dcl.v2` global localStorage key has no Firebase UID attached, so it is not automatically assigned to a signed-in account. This conservative choice prevents one person's old browser cache from being uploaded to another person's account. The old key is left intact; the new account-specific cache uses `dcl.v2.user.{uid}`.

**Security note:** these rules verify document ownership but do not validate the correctness of client-submitted fields or quiz scores. Any score stored directly from a browser can be modified by that browser's owner. Add stricter field/type/size validation in Firestore rules, and use trusted server-side validation if quiz results must be tamper-resistant. Never place service-account private keys or Admin SDK credentials in browser code.

### Firebase configuration and security

Firebase web configuration, including the API key, is delivered to the browser and **is not a server-side secret**. Do not put service-account private keys, Admin SDK credentials, private tokens, or other server secrets in client code or commit them to Git.

Protect the Firebase project by reviewing API-key restrictions where applicable, configuring Firebase Authentication and any enabled services correctly, and applying appropriate security rules to Firebase products such as Firestore or Storage if they are added. An API key being visible does not by itself grant access to protected user data; access controls and rules must be configured correctly. If a key has been abused or exposed beyond its intended use, review Google Cloud/Firebase guidance and rotate or restrict it as appropriate.

## Project structure

```text
.
├── index.html                  Main page, authentication UI, and app shell
├── agent/
│   ├── local_agent.py          Optional loopback-only real networking diagnostics
│   └── README.md               Local agent setup and security notes
├── favicon.png                 BitSecure favicon
├── css/
│   ├── tokens.css              Design tokens and themes
│   ├── base.css                Resets and base styles
│   ├── layout.css              App shell, sidebar, top bar, page layout
│   ├── components.css          Shared buttons, inputs, tables, tabs, and toasts
│   ├── dashboard.css           Dashboard
│   ├── lab.css                 Core-lab stages
│   ├── modules.css              Shared learning-module visuals
│   ├── learning.css            Tutorials and quiz styles
│   ├── responsive.css           Responsive layout and motion preferences
│   ├── login.css               Sign-in/sign-up styles
│   └── profile.css             User profile and password dialog styles
└── js/
    ├── app.js                  Application entry point; imports modules and boots UI
    ├── auth/
    │   ├── firebase-client.js  Firebase app, Auth, and Firestore initialization
    │   └── login.js            Sign-in, sign-up, reset, verification, profile, and sign-out flows
    ├── core/                   Shared state, storage, encoding, checksums, addressing, UI helpers
    ├── simulations/            Protocol and network simulation logic
    ├── app/                    Routing, navigation, dashboard, progress, notifications, theme
    ├── lab/                    Core-lab UI and transmission stages
    └── modules/
        ├── registry.js         Learning-module registry and groups
        ├── link-layer/         Framing, error detection, ARQ
        ├── network-layer/      Subnets, IP headers, routing
        ├── transport-layer/    TCP/UDP, handshake, congestion, sockets
        ├── application-layer/  DNS and HTTP/TLS
        ├── advanced/           Encapsulation, packet capture, troubleshooting
        └── learning/            Journey, tutorials, challenges, glossary

## How the app is organised

- `index.html` loads `js/app.js` as an ES module.
- `js/app.js` imports each learning module. Each module registers itself through `regMod()` in `js/modules/registry.js`.
- The router displays a module based on the URL hash (for example, `#/m/http`).
- UI modules live in `js/modules/`; protocol calculations and simulated server logic live in `js/simulations/`; shared helpers live in `js/core/`.
- After authentication, each user's progress is cached in a UID-specific localStorage entry and synchronized with Firestore at `users/{uid}/progress/overview`. The legacy `dcl.v2` key is not automatically assigned to an account because it is not associated with a user ID.
- The desktop sidebar collapsed state is stored separately in `localStorage` as `bitsecure-sidebar-collapsed`.

### Add a learning module

1. Create a file under the appropriate `js/modules/<area>/` directory.
2. Import `regMod` from `../registry.js` and register a module object with an `id`, `group`, `title`, `desc`, `obj`, and `mount(root)`.
3. Import the new module file in `js/app.js`. The import makes the module register at startup.
4. Test navigation into and out of the module. If it creates timers or external event listeners, return a cleanup function from `mount()`.

### Where to make changes

| Task | Location |
| --- | --- |
| Change a module's UI or interactions | `js/modules/<area>/<module>.js` |
| Change protocol/simulation logic | `js/simulations/<topic>.js` |
| Change Wi-Fi simulator UI | `js/modules/network-layer/wifi-simulator.js` and `css/wifi-simulator.css` |
| Change Wi-Fi signal/interference model | `js/simulations/wifi-simulation.js` |
| Change Wi-Fi simulator UI | `js/modules/network-layer/wifi-simulator.js` and `css/wifi-simulator.css` |
| Change Wi-Fi signal/interference model | `js/simulations/wifi-simulation.js` |
| Change module groups or ordering | `js/modules/registry.js` and imports in `js/app.js` |
| Change colours, typography, or theme tokens | `css/tokens.css` |
| Change shared controls and component styles | `css/components.css` |
| Change the sign-in/account flow | `js/auth/login.js` |
| Change Firebase initialization | `js/auth/firebase-client.js` |
| Change account/login presentation | `index.html`, `css/login.css`, and `css/profile.css` |
| Change quiz questions, tutorials, or glossary | `js/modules/learning/challenges.js`, `tutorials.js`, or `glossary.js` |
| Change real local networking diagnostics | `agent/local_agent.py` and `js/modules/advanced/troubleshooting.js` |

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Blank page or CORS/module errors | Start a local HTTP server; do not use `file://`. |
| A JavaScript file returns 404 | Check import paths and file names; relative imports must point to the correct `.js` file. |
| “does not provide an export named …” | Confirm the export exists and the import name/path matches. |
| Sign-in says the domain is unauthorized | Add the hostname in Firebase Authentication → Settings → Authorized domains. |
| Email/password sign-in is unavailable | Enable Email/Password in Firebase Authentication → Sign-in method. |
| Authentication configuration error | Check `js/auth/firebase-client.js` against the Firebase Web app configuration. |
| Firestore `permission-denied` | Verify that the user is signed in and your rules allow access only when `request.auth.uid == userId` for their UID path. |
| Progress differs between devices | Confirm both devices use the same Firebase project and account, then inspect the document at `users/{uid}/progress/overview`. |
| Old progress appears during testing | Check the account-specific `dcl.v2.user.{uid}` cache and the Firestore document. The legacy global cache is intentionally not auto-imported. |
| CSS changes do not appear | Hard-refresh the page to bypass cached stylesheets. |

## Manual smoke-test checklist

Before publishing a change, test the following in a browser:

1. Start the local server and confirm the page loads without console errors.
2. Visit every sidebar module and use browser Back/Forward navigation.
3. In the core lab, try ordinary text, an emoji, packet-size changes, different simulated loss levels, and stopping a transmission mid-run.
4. Exercise the relevant learning modules, including DNS, HTTP methods, TLS, TCP/UDP, and subnetting.
5. In the Wi-Fi simulator, add/remove access points and clients, edit SSID/band/channel/power, drag devices, add/remove obstacles, and check signal/interference updates. Confirm wired endpoints are labeled separately and saved layouts restore.
5. In the Wi-Fi simulator, add/remove access points and clients, edit SSID/band/channel/power, drag devices, add/remove obstacles, and check signal/interference updates. Confirm wired endpoints are labeled separately and saved layouts restore.
6. Switch the theme and reload; confirm it persists.
7. Collapse and restore the desktop sidebar; check the mobile navigation at a narrow viewport.
8. Sign in and confirm Firestore progress is loaded before the dashboard opens.
9. Visit modules and finish a quiz; verify progress syncs to Firestore and restores on another device.
10. Sign out, sign in as a different user, and confirm the first user's progress is not shown or uploaded to the second account.
11. Test offline mode; local changes should remain cached and a failed cloud read must not trigger a blind overwrite.

**Wi-Fi model limitation:** the wireless simulator runs entirely in the browser. Signal strength and interference are simplified normalized scores, not dBm measurements, live scans, or predictions of actual throughput. Obstacle penalties and channel overlap are educational approximations; security options are labels only and do not perform Wi-Fi encryption.

## Contributing

Keep protocol logic separate from DOM rendering where practical, use the existing shared helpers and design tokens, and avoid adding duplicate copies of shared state. Keep changes focused and test the affected module plus navigation before committing.

## Glossary

- **ES module:** a JavaScript file that shares functionality through `import` and `export`.
- **DOM:** the browser's live document tree.
- **Event delegation:** handling events from child elements through a listener on a stable parent.
- **Hash routing:** using the URL fragment (the part after `#`) to select a screen without a full page reload.
- **TLS:** Transport Layer Security, the protocol used to protect data in transit.
- **ARQ:** Automatic Repeat reQuest, a family of error-control techniques that use acknowledgements and retransmissions.


## Optional real networking commands

The Troubleshooting Lab now has two explicit modes:

- **Simulation:** the existing guided fault cases and simulated outputs remain unchanged.
- **Real diagnostics:** sends supported commands to the optional local agent on your own computer. See [agent/README.md](agent/README.md) for setup, allowed commands, and origin configuration.

The local agent binds only to `127.0.0.1`, validates a fixed command allowlist, invokes subprocesses without a shell, and applies runtime/output limits. It does not provide a general-purpose shell. Real commands can reveal your machine's network configuration and send packets to the destinations you specify, so only run diagnostics against systems you are authorized to test. Browser private-network restrictions or firewall settings may prevent a hosted HTTPS page from contacting localhost; the UI reports agent errors and never silently substitutes simulated output.
