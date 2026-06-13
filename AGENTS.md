# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository. This is
the canonical agent-instructions file; tool-specific files such as `CLAUDE.md`
point here.

Wasel is an Arabic-first AI search engine built on Next.js 15 (App Router) and
the Vercel AI SDK. It is a fork of [Morphic](https://github.com/miurla/morphic).

## Before you open a PR

Run all of these and make sure they pass:

```bash
npx tsc --noEmit   # type checking
npm test           # unit tests (Jest)
npm run lint       # linting (next lint / ESLint)
npm run build      # production build
```

Use [conventional commits](CONTRIBUTING.md#commit-convention)
(`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).

## Project conventions and gotchas

These are the non-obvious ones that are easy to get wrong:

- **Arabic / RTL text.** `\b` regex word boundaries never match Arabic. Use
  Unicode-aware boundaries instead:
  `(?<![\p{L}\p{N}_])…(?![\p{L}\p{N}_])` with the `u` flag. The UI renders with
  `dir="rtl"` — test layout changes in RTL.

- **Dual storage.** Chat data lives in both Supabase (free/pro users) and an
  Upstash Redis cache. Guests live **only** in Redis with a 24h TTL. Messages
  are stored in the Redis hash as a JSON **string** — every reader must
  `JSON.parse` them. Forgetting this is a recurring source of bugs.

- **Edge vs Node runtimes.** The chat routes (`/api/chat`, `/api/chat/ephemeral`)
  run on the **edge** runtime. `/api/advanced-search` runs on **Node** (it uses
  jsdom and HTTP agents) and is called over HTTP from the edge with an
  `x-internal-key` bypass header. Keep edge routes free of Node-only APIs.

- **Rate limiting** lives in `middleware.ts` (Lua scripts via
  `lib/rate-limiter-atomic.ts`). The dedup window must never bypass the limiter.

- **Supabase functions** must use `SET search_path = public, pg_temp` — not an
  empty path, which breaks the pgvector `<=>` operator (the vector extension
  lives in the `public` schema). See `.cursor/rules/` for the full SQL, RLS,
  and migration conventions.

- **CAPTCHA (Cloudflare Turnstile) is optional**, gated on
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. When unset (the local/self-host default),
  the widget and token checks are skipped across all auth flows. Keep both the
  set and unset paths working when touching auth.

## Secrets

Never commit API keys, service-account JSON, `.env*` files, or any credentials —
including in tests or fixtures. Local config goes in `.env.local` (gitignored);
add new variables to `.env.local.example` with placeholder values. Redact
tokens and user data from any logs you paste into issues or PRs.

## More detail

- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution workflow and setup
- [README.md](README.md) — features, stack, quickstart, deployment
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) — optional feature configuration
- [SECURITY.md](SECURITY.md) — reporting vulnerabilities
