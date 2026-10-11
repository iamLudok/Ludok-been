# Security Policy

## Supported Versions

Ludok Been is a personal project. Only the latest release receives security fixes.

| Version | Supported |
|---|---|
| Latest release / `main` | ✅ |
| Older releases | ❌ |

## Reporting a Vulnerability

**Please do not report security problems in a public issue.** Issues are visible to everyone, so
describing a vulnerability there would show anyone how to exploit it before a fix is available.

Report it privately through GitHub instead:

1. Go to the [Security tab](https://github.com/iamLudok/Ludok-been/security) of this repository
2. Click **Report a vulnerability**
3. Describe the issue, how to reproduce it, and its possible impact

Only the maintainer can see the report. You can expect a first response within a week. Once the
issue is confirmed and fixed, the details are made public and you will be credited, unless you
prefer to stay anonymous.

## Scope

In scope:

- Leaks of the Nextcloud credentials stored by the app (for example, the password ending up in an exported backup or in logs)
- Importing a crafted backup file that corrupts data or crashes the app
- Data stored outside the app's private storage without the user asking for it

Out of scope:

- Vulnerabilities in Android, Expo, Nextcloud or other third-party software (report those upstream)
- Problems that require root access or physical access to an unlocked phone
- APKs not downloaded from this repository's Releases page

## Keeping Your Data Safe

- **Install only from [Releases](https://github.com/iamLudok/Ludok-been/releases).** Updates only install on top of an APK signed with the same key.
- **Use a Nextcloud app password**, not your account password, so you can revoke it at any time.
- **Don't send Nextcloud traffic over plain HTTP outside your home network.** The app allows `http://` for local servers; use HTTPS or a VPN when your server is reachable from the internet.
- **Treat backup files as personal data.** They don't contain your Nextcloud password, but they do contain your full travel history.
