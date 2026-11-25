# Security Policy

## Supported Versions

Security fixes are maintained on the latest `main` branch and current `v2.x` releases of Sangeet.

| Version | Supported |
| :--- | :--- |
| `2.3.x` | Yes |
| `< 2.3` | No |

## Built-In Security Controls

Sangeet is architected with defense-in-depth and a local-first privacy posture:

- **Strict Transport & Browser Headers**: Production responses enforce `Content-Security-Policy` (CSP), `Strict-Transport-Security` (HSTS), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
- **SSRF & Redirect Validation**: Server-side media, proxy, and metadata routes validate target URLs, restrict allowed hostnames/schemes, block private/loopback IP ranges, and guard against unsafe HTTP redirects.
- **Rate Limiting**: API endpoints apply per-client sliding-window rate limits to mitigate abuse and automated scraping.
- **HMAC-Signed OAuth & Session Protection**: Optional Google OAuth uses cryptographic CSRF `state` verification and HMAC-SHA256 signed `HttpOnly`, `SameSite=Lax`, `Secure` session cookies.
- **Local-First Storage**: Playlists, listening history, likes, EQ settings, and offline caches stay on the user's device — no third-party tracking database is required.

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues, pull requests, or discussions.

Instead, report vulnerabilities responsibly using **GitHub Security Advisories** (`Security` → `Advisories` → `Report a vulnerability` on this repository).

Please include:
1. A clear description of the vulnerability and affected file(s) or endpoint(s).
2. Minimal steps to reproduce or a proof of concept.
3. Potential impact and any suggested remediation.

We aim to acknowledge reports within **72 hours** and coordinate a fix and disclosure timeline with you promptly.
