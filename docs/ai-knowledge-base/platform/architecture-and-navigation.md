# BitSecure Platform Architecture and Navigation

## Product overview

BitSecure is an interactive, browser-based Data Communications and Computer Networks learning platform. It combines guided lessons, protocol labs, visual simulations, quizzes, challenges, glossary content, and progress indicators.

The application uses HTML, CSS, and native JavaScript ES modules. The main page is `index.html`; it loads `js/app.js` as a module.

## Application startup

- `index.html` provides the login screen and authenticated application shell.
- `js/app.js` imports the module files, sorts registered modules into learning-path order, initializes the application UI, and starts routing after the `auth-success` event or when an authenticated session is already restored.
- `js/modules/registry.js` defines learning groups and the module registration contract.
- Each module registers a plain object containing an id, group, title, description, and a `mount(root)` function.
- `js/app/router.js` handles hash-based navigation.
- `js/core/` contains shared state, storage, and utility helpers.
- `js/simulations/` contains protocol/network models.
- `js/lab/` contains the core transmission lab.

## Learning-path groups

The registry defines these groups in display order:

1. Link and errors
2. Reliable transfer
3. Network layer
4. Transport layer
5. Application layer
6. Advanced
7. Journey and learning

The module registry is the source of truth for registered learning modules. The README and module imports should be checked when maintaining this document.

## Search and navigation

The application uses hash routes (for example, a module route such as `#/m/http`). The module search helps learners find learning modules by topic. The desktop sidebar and mobile navigation provide access to learning groups and screens.

## Educational boundary

Most networking activities are browser-based simulations. They do not configure the learner's operating system, change a real router/firewall, or send simulated packets across the public internet. Some local network inventory functionality is separately documented and requires a local helper; do not confuse that optional feature with the browser-only simulators.
