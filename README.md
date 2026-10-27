# BitSecure — Data Communications Lab

BitSecure is an interactive, browser-based data communications and networking learning lab. Explore how a message moves through network layers, inspect protocol headers, simulate network behaviour, and practise with guided modules and challenges.

## Features

- **Core end-to-end lab:** follow text through UTF-8 bytes, packetization, transmission over a simulated lossy link, retries, reassembly, and decoding.
- **Link layer:** framing and stuffing, error detection, Stop-and-Wait, and sliding-window ARQ.
- **Network layer:** IPv4/subnet practice, IP headers, and routing.
- **Transport layer:** TCP/UDP comparisons and header building, handshake steps, congestion control, and sockets.
- **Application layer:** DNS resolution and caching, an HTTP Status Code Explorer based on the IANA registry, HTTP request/response simulations, and TLS handshake/encryption demonstrations.
- **Advanced topics:** encapsulation, packet capture and display filters, and troubleshooting exercises.
- **Learning tools:** tutorials, challenges/quizzes, glossary, progress indicators, achievements, and theme selection.
- **Accounts:** Firebase Authentication email/password sign-up and sign-in, password-reset email, email verification, profile menu, password change, and sign-out.
- **Responsive interface:** desktop sidebar controls and a mobile navigation drawer.

Most networking demonstrations are simulations intended for learning; the HTTP server and network scenarios shown in the modules are not real remote services.

## Requirements

- A modern browser with JavaScript modules and the Web Crypto API (for the cryptography demonstration).
- Python 3 or another local static HTTP server.
- A Firebase project configured for the authentication features.

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
5. Update the configuration in `js/auth/firebase-client.js` to match your Firebase Web app.
6. Run the app through a local HTTP server and test sign-up, sign-in, email verification, password reset, password change, and sign-out.

### Firebase configuration and security

Firebase web configuration, including the API key, is delivered to the browser and **is not a server-side secret**. Do not put service-account private keys, Admin SDK credentials, private tokens, or other server secrets in client code or commit them to Git.

Protect the Firebase project by reviewing API-key restrictions where applicable, configuring Firebase Authentication and any enabled services correctly, and applying appropriate security rules to Firebase products such as Firestore or Storage if they are added. An API key being visible does not by itself grant access to protected user data; access controls and rules must be configured correctly. If a key has been abused or exposed beyond its intended use, review Google Cloud/Firebase guidance and rotate or restrict it as appropriate.

## Project structure

```text
.
├── index.html                  Main page, authentication UI, and app shell
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
    │   ├── firebase-client.js  Firebase app and Auth initialization
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
```

## How the app is organised

- `index.html` loads `js/app.js` as an ES module.
- `js/app.js` imports each learning module. Each module registers itself through `regMod()` in `js/modules/registry.js`.
- The router displays a module based on the URL hash (for example, `#/m/http`).
- UI modules live in `js/modules/`; protocol calculations and simulated server logic live in `js/simulations/`; shared helpers live in `js/core/`.
- Most learning progress and the selected theme are saved in browser `localStorage` under `dcl.v2`. This data is local to that browser/device and is not a cross-device progress database.
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
| Change module groups or ordering | `js/modules/registry.js` and imports in `js/app.js` |
| Change colours, typography, or theme tokens | `css/tokens.css` |
| Change shared controls and component styles | `css/components.css` |
| Change the sign-in/account flow | `js/auth/login.js` |
| Change Firebase initialization | `js/auth/firebase-client.js` |
| Change account/login presentation | `index.html`, `css/login.css`, and `css/profile.css` |
| Change quiz questions, tutorials, or glossary | `js/modules/learning/challenges.js`, `tutorials.js`, or `glossary.js` |

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Blank page or CORS/module errors | Start a local HTTP server; do not use `file://`. |
| A JavaScript file returns 404 | Check import paths and file names; relative imports must point to the correct `.js` file. |
| “does not provide an export named …” | Confirm the export exists and the import name/path matches. |
| Sign-in says the domain is unauthorized | Add the hostname in Firebase Authentication → Settings → Authorized domains. |
| Email/password sign-in is unavailable | Enable Email/Password in Firebase Authentication → Sign-in method. |
| Authentication configuration error | Check `js/auth/firebase-client.js` against the Firebase Web app configuration. |
| Old progress appears during testing | Clear the site's local storage or use the app's Reset progress control if available. |
| CSS changes do not appear | Hard-refresh the page to bypass cached stylesheets. |

For browser debugging, open Developer Tools and inspect **Console** for JavaScript errors and **Network** to check that HTML, CSS, and JavaScript files load successfully.

## Manual smoke-test checklist

Before publishing a change, test the following in a browser:

1. Start the local server and confirm the page loads without console errors.
2. Visit every sidebar module and use browser Back/Forward navigation.
3. In the core lab, try ordinary text, an emoji, packet-size changes, different simulated loss levels, and stopping a transmission mid-run.
4. Exercise the relevant learning modules, including DNS, HTTP methods, TLS, TCP/UDP, and subnetting.
5. Switch the theme and reload; confirm it persists.
6. Collapse and restore the desktop sidebar; check the mobile navigation at a narrow viewport.
7. Test authentication flows against your configured Firebase project.
8. Check keyboard navigation, focus visibility, and responsive layout.

## Contributing

Keep protocol logic separate from DOM rendering where practical, use the existing shared helpers and design tokens, and avoid adding duplicate copies of shared state. Keep changes focused and test the affected module plus navigation before committing.

## Glossary

- **ES module:** a JavaScript file that shares functionality through `import` and `export`.
- **DOM:** the browser's live document tree.
- **Event delegation:** handling events from child elements through a listener on a stable parent.
- **Hash routing:** using the URL fragment (the part after `#`) to select a screen without a full page reload.
- **TLS:** Transport Layer Security, the protocol used to protect data in transit.
- **ARQ:** Automatic Repeat reQuest, a family of error-control techniques that use acknowledgements and retransmissions.
