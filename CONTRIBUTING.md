# Contributing to BitSecure

Thank you for your interest in improving BitSecure! Contributions that improve the learning experience, correctness of networking concepts, accessibility, documentation, and reliability are welcome.

## Before you start

- Read the project overview and setup instructions in [README.md](README.md).
- Check existing issues and pull requests to avoid duplicating work.
- For a substantial feature, architectural change, or behaviour change, open an issue first to discuss the approach.
- For security vulnerabilities, **do not open a public issue**. Follow [SECURITY.md](SECURITY.md).

## Development setup

BitSecure uses HTML, CSS, and native JavaScript ES modules, with Firebase Authentication and Cloud Firestore for account features.

1. Fork the repository and clone your fork.
2. Open a terminal in the project root.
3. Start a local HTTP server:

   ```bash
   python3 -m http.server 8000
   ```

4. Open [http://localhost:8000](http://localhost:8000).

You can also use VS Code Live Server or `npx serve`. Do not open `index.html` directly with `file://`; browser module loading generally requires HTTP or HTTPS.

If you are working on account or cloud-progress features, use your own Firebase test project and follow the Firebase setup and security guidance in the README. Never use production credentials or real user data for local testing.

## Branching and commits

Create a focused branch from the current `main` branch:

```bash
git switch main
git pull origin main
git switch -c feature/short-description
```

Use a descriptive branch name, such as `fix/dns-cache-display`, `docs/update-setup`, or `feature/new-learning-lab`.

Keep commits focused and write clear commit messages that explain the change.

## Project conventions

- Keep protocol and simulation logic separate from DOM rendering where practical.
- Reuse shared helpers, components, and CSS design tokens instead of duplicating them.
- Follow the existing native ES module and module-registry patterns.
- Register new learning modules through `js/modules/registry.js` and import them from `js/app.js`, following the README's “Add a learning module” guide.
- Keep changes scoped to the feature or fix; avoid unrelated formatting or refactoring.
- Make interactive controls accessible, keyboard-friendly, and clear about their state.
- Keep educational simulations clearly distinguished from real network operations. Do not imply that a browser simulation configures a real device or network.
- Do not commit API secrets, service-account keys, private keys, passwords, tokens, user data, or local environment files.

## Testing your changes

Run the automated rules tests when applicable:

```bash
node --test tests/rules.test.mjs
```

Then run the application locally and test the affected feature. At minimum:

- Check the browser console for errors.
- Test the relevant user flow, including navigation into and out of the changed screen.
- Check responsive behaviour on a narrow/mobile viewport.
- Verify loading, empty, success, and error states where relevant.
- For simulations, test representative normal and edge-case inputs.
- For authentication or progress changes, test sign-in/sign-out and account isolation with test accounts; never use another user's account.
- Update documentation when setup steps, limitations, or user-facing behaviour change.

If a test cannot be run, mention that clearly in your pull request rather than claiming it passed.

## Pull requests

1. Push your branch to your fork.
2. Open a pull request targeting `sahilvxky25/DC_Project:main`.
3. Describe the problem and the solution.
4. List the important files or areas changed.
5. Include screenshots or a short recording for visible UI changes.
6. List the tests you ran and their results.
7. Note any known limitations, follow-up work, or configuration changes.

Keep each pull request focused and be prepared to respond to review feedback. Maintainers may request changes before merging.

## Questions

For general contribution questions or feature discussions, use GitHub Discussions or open a non-security issue in the repository. Do not use public issues to disclose vulnerabilities; see [SECURITY.md](SECURITY.md).
