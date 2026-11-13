# AGENTS.md — BitSecure / DC_Project

## Project overview

BitSecure is a browser-based Data Communications and Computer Networks learning platform. It uses HTML, CSS, native JavaScript ES modules, Firebase Authentication, and Cloud Firestore. Most protocol and networking activities are educational simulations running in the browser; do not describe them as real network operations.

## Repository map

- `index.html`: application shell, DOM mount points, stylesheet order, and the entry script.
- `js/app.js`: application entry point. It imports feature modules, sorts registered modules, initializes the core lab/search/cookie consent/game UI, and starts routing after authentication.
- `js/auth/`: Firebase client setup and sign-in, sign-up, verification, password, and sign-out flows.
- `js/core/`: shared state, storage, encoding, checksums, addressing, and UI helpers.
- `js/app/`: routing, navigation, theme, search, progress-related UI, notifications, and cookie consent.
- `js/lab/`: the four-stage end-to-end data transmission lab.
- `js/simulations/`: reusable protocol, packet, error-control, routing, DNS, and transport simulation logic.
- `js/modules/`: registered learning modules, grouped into `link-layer/`, `network-layer/`, `transport-layer/`, `application-layer/`, `advanced/`, and `learning/`.
- `css/`: ordered global stylesheets and feature-specific stylesheets.
- `tools/network-agent/`: optional local, read-only Python helper for viewing OS-reported network information. It is separate from the browser-only learning simulations.

## Architecture and extension points

### Learning modules

- Module files register themselves through `regMod()` from `js/modules/registry.js`.
- A module registration has an `id`, a valid `group` from `GROUPS`, a `title`, a `desc`, and a `mount(root)` function.
- `mount(root)` renders the module into its supplied root element. If it creates timers, observers, or event listeners that outlive the render, return a cleanup function and ensure it releases those resources.
- When adding a module, create it under the appropriate `js/modules/<area>/` folder and add its import to `js/app.js`. Do not assume that a file is discovered automatically.
- Keep group IDs and ordering consistent with `GROUPS` in `js/modules/registry.js`.

### Shared logic

- Put reusable protocol or network calculations in `js/simulations/` rather than duplicating them across module UIs.
- Keep shared application state in the existing core state/storage abstractions. Inspect current exports before adding a second source of truth.
- Use explicit ES module imports and exports. Avoid adding new globals to `window` unless integration with an external browser API genuinely requires it and the existing architecture provides no better option.
- Preserve the separation between DOM/UI code, simulation logic, authentication, and persistence.

### Styling

- `index.html` loads stylesheets in a deliberate order; later styles can override earlier ones. Preserve that order unless a change requires a documented adjustment.
- Prefer existing design tokens in `css/tokens.css` and shared component conventions over hard-coded colours or one-off styles.
- Keep responsive behaviour in mind. Test desktop and mobile layouts when changing navigation, dialogs, forms, or dense simulator panels.
- Scope feature-specific selectors to the feature to avoid leaking styles into unrelated modules.

## Change guidelines

1. Read the target file and its imports/callers before editing. Follow the established patterns in neighbouring modules.
2. Make the smallest cohesive change that solves the request. Avoid broad refactors, unrelated formatting, or replacing working architecture.
3. Preserve existing behaviour and public module contracts unless the task explicitly asks to change them.
4. Handle empty, invalid, boundary, and failure states. Give users visible, accessible feedback rather than silently ignoring errors.
5. Use semantic HTML, labels for form controls, keyboard-operable interactions, and appropriate ARIA state where needed.
6. Clean up event listeners, timers, animation frames, and object URLs when a view is unmounted or a workflow ends.
7. Keep simulated results clearly identified as simulations or estimates. Do not imply that browser labs ping hosts, scan ports, capture live traffic, or modify network configuration unless the relevant feature explicitly does so.
8. Do not add dependencies or a build system for a task that can be completed with the existing native-module architecture.
9. Update relevant documentation when changing setup, feature behaviour, security assumptions, or project structure.

## Authentication, persistence, and security

- Authentication is handled through Firebase Authentication. Keep auth lifecycle changes within the existing `js/auth/` flow and coordinate app startup with the existing authentication event/session handling.
- Learning progress uses local account-specific caching and Firestore synchronization. Inspect `js/core/storage.js` and its callers before changing merge, debounce, logout, or account-switch behaviour.
- Never allow one account's in-memory or cached progress to be uploaded under another account. Preserve UID ownership checks and stale-operation guards.
- Firebase web configuration is client-visible; it is not a server-side secret. Never commit service-account keys, Admin SDK credentials, private keys, tokens, or other secrets. Do not weaken Firestore rules or recommend broad test-mode rules for production.
- Client-side quiz or league scores are not trustworthy merely because they are stored in Firestore. Do not introduce claims of tamper-proof scoring without trusted server-side validation.
- Treat uploaded files as untrusted input. Validate supported type and size, handle read/preview failures, and revoke generated object URLs when no longer needed.
- Do not turn an educational simulation into a real-world network action without explicit product requirements, clear user consent, and an appropriate security review.

## Local development and verification

Run the static site over HTTP; do not open `index.html` through `file://`, because the application relies on ES modules.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

There is no test/build command documented in the project README. Do not invent one. For each change:

- Run any relevant checks that are actually available in the repository.
- Load the site and check the browser console for module/import/runtime errors.
- Exercise the changed interaction and its error/empty states.
- Test affected navigation and browser Back/Forward behaviour.
- For UI changes, check both desktop and mobile widths.
- For auth/progress changes, test sign-in, sign-out, account switching, cloud failure/offline fallback, and account isolation as applicable.
- For simulation changes, verify representative normal, boundary, and failure scenarios.

## Useful project references

- `README.md`: setup, project structure, Firebase configuration, feature overview, and manual smoke-test checklist.
- `REFACTOR-REPORT.md`: rationale and history for the modular JavaScript architecture. Its historical test results are not proof that the current branch passes fresh tests.
- `js/modules/registry.js`: module registration contract and learning-path groups.
- `js/app.js`: startup sequence and module import list.
- `js/core/storage.js`: local progress, Firestore synchronization, merge, and account lifecycle behaviour.
