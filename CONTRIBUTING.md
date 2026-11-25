# Contributing to Sangeet

Thank you for your interest in contributing to **Sangeet**! We welcome bug reports, accessibility improvements, performance optimizations, documentation fixes, and new features.

## Getting Started

1. **Fork** the repository on GitHub and clone your fork locally.
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Install dependencies and set up local environment**:
   ```bash
   npm install
   cp .env.example .env.local
   npm run dev
   ```

## Security & Secrets Hygiene

- **Never commit secrets or local config files.** `.env`, `.env.*` (except `.env.example`), signing keys (`*.keystore`, `*.jks`), certificates (`*.pem`, `*.key`, `*.p12`, `*.crt`), and `android/local.properties` are ignored by `.gitignore` and must never be added to git history.
- Do not hardcode API keys, OAuth secrets, personal tokens, or machine-specific paths in code or tests.

## Code Quality & Pre-PR Checklist

Before opening a pull request, make sure every check passes with zero errors:

```bash
npm run typecheck && npm test && npm run build
```

Please also ensure your changes:
- Follow existing TypeScript, React 19, and Tailwind CSS conventions in the repository.
- Respect both **Dark (Zentra Obsidian)** and **Light** themes and remain responsive across mobile and desktop viewports.
- Keep commits focused, clear, and easy to review.

## Opening a Pull Request

1. Push your branch to your fork.
2. Open a Pull Request against `main` with a concise summary of what changed and why.
3. Include screenshots or short recordings for visual/UI changes.
4. Respond to review feedback promptly.

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
