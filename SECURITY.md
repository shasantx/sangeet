# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's **Report a vulnerability** feature on this repository. Include the affected area and steps to reproduce. Do not publish exploit details or credentials in a public issue.

## Secret handling

Keep OAuth client secrets, session-signing secrets, database service-role keys, and token-encryption keys in the deployment provider's secret store or a local ignored environment file. Never add them to client-side variables, source files, screenshots, issues, or commits. If a secret is exposed, revoke or rotate it immediately and remove it from Git history before making the repository public.
