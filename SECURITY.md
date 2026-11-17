# Security Policy

## Supported versions

Security fixes are generally made against the latest version on the `main` branch. If you use a deployed copy or an older commit, please update to the latest supported version before assuming an issue is still present.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.** Public reports can expose users before a fix is available.

Use GitHub's private vulnerability reporting channel:

1. Open the repository on GitHub.
2. Select the **Security** tab.
3. Choose **Report a vulnerability** (or **Report a vulnerability privately**, depending on the GitHub interface).
4. Include the details listed below.

If the private reporting option is unavailable, contact the repository maintainer privately through the contact options on the maintainer's GitHub profile. Do not publish exploit details while waiting for a response.

### What to include

- A clear description and potential impact.
- The affected page, feature, file, or commit, if known.
- Steps to reproduce the issue.
- A minimal proof of concept, screenshots, or a short recording where useful.
- Any suggested mitigation.
- Your preferred way to be credited, or a request to remain anonymous.

Please redact passwords, access tokens, personal information, and other secrets from reports and attachments.

## What to report

Examples include authentication or authorization bypasses, exposure of another user's data, insecure Firestore access rules, cross-site scripting, injection, unintended sensitive-data disclosure, and accidentally committed credentials.

BitSecure contains browser-based educational simulations. A simulated packet, firewall rule, network scan, or cryptography demonstration is not by itself evidence of a vulnerability in a real network service. Please explain the actual security boundary or user data affected.

## Responsible testing

- Test only accounts, data, and systems you own or are explicitly authorized to assess.
- Do not access, modify, or delete another person's data.
- Do not perform denial-of-service testing, spam users, or disrupt the deployed service.
- Do not use social engineering or physical attacks.
- Stop testing and report promptly if you encounter real user data or credentials.

## Response and disclosure

The maintainers will make a reasonable effort to acknowledge and investigate a valid report, keep the reporter informed when practical, and coordinate a fix and disclosure timeline. Response and remediation times are not guaranteed; please allow maintainers a reasonable opportunity to investigate and address the issue before public disclosure.

Thank you for helping keep BitSecure and its users safe.
