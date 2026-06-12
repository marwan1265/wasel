# Contributing to Wasel

Thank you for your interest in contributing to Wasel! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Issues

- Check if the issue already exists in our [GitHub Issues](https://github.com/marwan1265/wasel_v2/issues)
- Use the issue templates when creating a new issue
- Provide as much context as possible
- **Security vulnerabilities**: do not open a public issue — follow the [Security Policy](SECURITY.md) instead

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Make your changes
4. Verify your changes pass the checks below
5. Commit your changes using conventional commits:
   ```bash
   git commit -m "feat: add new feature"
   ```
6. Push to your fork
7. Open a Pull Request using the PR template

### Commit Convention

We use conventional commits. Examples:

- `feat: add new feature`
- `fix: resolve issue with X`
- `docs: update README`
- `chore: update dependencies`
- `refactor: improve code structure`

## Development Setup

Follow the [Quickstart](README.md#-quickstart) guide in the README to set up
your development environment. CAPTCHA (Cloudflare Turnstile) is optional and
disabled by default locally — see the
[Configuration section](README.md#%EF%B8%8F-configuration).

### Verifying Your Changes

Before opening a PR, please make sure all of these pass:

```bash
npx tsc --noEmit   # type checking
npm test           # unit tests (Jest)
npm run lint       # linting
npm run build      # production build
```

### Secrets and Configuration

- Never commit API keys, service-account files, `.env*` files, or other
  credentials — even in tests or fixtures. Use `.env.local` (gitignored) for
  local configuration and add new variables to `.env.local.example` with
  placeholder values.
- When pasting logs into issues or PRs, redact tokens, cookies, and user data.

### Arabic / RTL Considerations

Wasel is Arabic-first. When touching text processing or UI:

- Do not use `\b` word boundaries in regex — they never match Arabic. Use
  Unicode-aware boundaries (`(?<![\p{L}\p{N}_])…(?![\p{L}\p{N}_])` with the `u`
  flag) instead.
- Test UI changes in RTL layout (the app renders with `dir="rtl"`).

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
