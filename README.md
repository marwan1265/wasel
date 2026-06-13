# Wasel

An AI-powered search engine with a generative UI.



## 🗂️ Overview

- 🛠 [Features](#-features)
- 🧱 [Stack](#-stack)
- 🚀 [Quickstart](#-quickstart)
- 🌐 [Deploy](#-deploy)
- ⚙️ [Configuration](#%EF%B8%8F-configuration)
- 🔎 [Search Engine](#-search-engine)
- ✅ [Verified models](#-verified-models)
- 👥 [Contributing](#-contributing)

📝 Explore AI-generated documentation on [DeepWiki](https://deepwiki.com/marwan1265/wasel_v2)

## 🛠 Features

### Core Features

- AI-powered search with GenerativeUI
- Natural language question understanding
- Multiple search providers support (Tavily, SearXNG, Exa)
- Model selection from UI (switch between available AI models)
  - Reasoning models with visible thought process

### Authentication

- User authentication powered by [Supabase Auth](https://supabase.com/docs/guides/auth)
- Supports Email/Password sign-up and sign-in
- Supports Social Login with Google

### Chat & History

- Chat history functionality (Optional)
- Share search results (Optional)
- Redis support (Local/Upstash)

### AI Providers

The following AI providers are supported (deepseek is the only one used as of May 18th, 2025):

- OpenAI (Default)
- Google Generative AI
- Azure OpenAI
- Anthropic
- Ollama
- Groq
- DeepSeek
- Fireworks
- xAI (Grok)
- OpenAI Compatible

Models are configured in `public/config/models.json`. Each model requires its corresponding API key to be set in the environment variables. See [Configuration Guide](docs/CONFIGURATION.md) for details.

### Search Capabilities

- URL-specific search
- Video search support (Optional)
- SearXNG integration with:
  - Customizable search depth (basic/advanced)
  - Configurable engines
  - Adjustable results limit
  - Safe search options
  - Custom time range filtering

### Additional Features

- Docker deployment ready
- Browser search engine integration

## 🧱 Stack

### Core Framework

- [Next.js](https://nextjs.org/) - App Router, React Server Components
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vercel AI SDK](https://sdk.vercel.ai/docs) - Text streaming / Generative UI

### Authentication & Authorization

- [Supabase](https://supabase.com/) - User authentication and backend services

### AI & Search

- [OpenAI](https://openai.com/) - Default AI provider (Optional: Google AI, Anthropic, Groq, Ollama, Azure OpenAI, DeepSeek, Fireworks)
- [Tavily AI](https://tavily.com/) - Default search provider
- Alternative providers:
  - [SearXNG](https://docs.searxng.org/) - Self-hosted search
  - [Exa](https://exa.ai/) - Neural search

### Data Storage

- [Upstash](https://upstash.com/) - Serverless Redis
- [Redis](https://redis.io/) - Local Redis option

### UI & Styling

- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - Re-usable components
- [Radix UI](https://www.radix-ui.com/) - Unstyled, accessible components
- [Lucide Icons](https://lucide.dev/) - Beautiful & consistent icons


## 🚀 Quickstart

### Prerequisites

- Node.js 20+ and npm
- A [Supabase](https://supabase.com/) project (free tier works) — used for
  authentication, the application database, and file storage. Apply the schema
  in `supabase/migrations/` to your project by following the
  [Supabase Setup Guide](docs/SETUP_SUPABASE.md)
- An API key for at least one AI provider (e.g. DeepSeek or OpenAI) and one
  search provider (e.g. [Tavily](https://app.tavily.com/home))

### Run locally

```bash
git clone https://github.com/marwan1265/wasel_v2.git
cd wasel_v2
npm install
cp .env.local.example .env.local
# Edit .env.local and set at minimum:
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
#   an AI provider key (e.g. DEEPSEEK_API_KEY or OPENAI_API_KEY)
#   TAVILY_API_KEY
npm run dev
```

Open http://localhost:3000. Persistent chat history additionally requires
Redis (local or Upstash) — see the
[Configuration Guide](docs/CONFIGURATION.md). CAPTCHA is disabled by default
for local development (see [Configuration](#%EF%B8%8F-configuration) below).

## 🌐 Deploy

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmarwan1265%2Fwasel_v2&env=OPENAI_API_KEY,TAVILY_API_KEY,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN)

### Docker

Build the image from the included `Dockerfile`:

```bash
docker build -t wasel .
```

You can use it with docker-compose:

```yaml
services:
  wasel:
    build: .
    env_file: .env.local
    ports:
      - '3000:3000'
    volumes:
      - ./models.json:/app/public/config/models.json # Optional: Override default model configuration
```

The default model configuration is located at `public/config/models.json`. For Docker deployment, you can create `models.json` alongside `.env.local` to override the default configuration.

## ⚙️ Configuration

Copy `.env.local.example` to `.env.local` and fill in your keys (Supabase, your
LLM provider(s), and a search provider at minimum).

### CAPTCHA (Cloudflare Turnstile) — optional

Bot protection on sign-up, login, and guest sessions is **optional** and
controlled by a single variable:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` **unset** (default): no CAPTCHA — auth works
  out of the box for local development and self-hosting.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` **set**: the Turnstile widget is shown and a
  token is required for all auth flows (recommended for production). You must
  also enable CAPTCHA protection with the matching **secret key** in your
  Supabase project under Auth → Attack Protection, since Supabase performs the
  actual verification.

## 🔎 Search Engine

### Setting up the Search Engine in Your Browser

If you want to use Wasel as a search engine in your browser, follow these steps:

1. Open your browser settings.
2. Navigate to the search engine settings section.
3. Select "Manage search engines and site search".
4. Under "Site search", click on "Add".
5. Fill in the fields as follows:
   - **Search engine**: Wasel
   - **Shortcut**: Wasel
   - **URL with %s in place of query**: `https://wasel.chat/search?q=%s`
6. Click "Add" to save the new search engine.
7. Find "Wasel" in the list of site search, click on the three dots next to it, and select "Make default".

This will allow you to use Wasel as your default search engine in the browser.

## ✅ Verified models

### List of models applicable to all

- OpenAI
  - gpt-4.1
  - gpt-4.1-mini
  - gpt-4.1-nano
  - o3-mini
  - gpt-4o
  - gpt-4o-mini
  - gpt-4-turbo
  - gpt-3.5-turbo
- Google
  - Gemini 2.5 Pro (Experimental)
  - Gemini 2.0 Flash Thinking (Experimental)
  - Gemini 2.0 Flash
- Anthropic
  - Claude 3.5 Sonnet
  - Claude 3.5 Haiku
- Ollama
  - qwen2.5
  - deepseek-r1
- Groq
  - deepseek-r1-distill-llama-70b
  - Llama 4 Maverick 17B
- Fireworks
  - DeepSeek R1
  - Llama 4 Maverick
- DeepSeek
  - DeepSeek V3
  - DeepSeek R1
- xAI
  - grok-2
  - grok-2-vision
  - grok-3-beta

## 👥 Contributing

Contributions are welcome! Please read the
[Contributing Guide](CONTRIBUTING.md) for how to set up your environment,
the commit convention, and the pull request process. To report a security
vulnerability, please follow the [Security Policy](SECURITY.md) instead of
opening a public issue.

## License

This project is licensed under the [Apache License 2.0](LICENSE).

## Acknowledgements

Wasel is a fork of [Morphic](https://github.com/miurla/morphic), an
AI-powered answer engine created by [Yoshiki Miura](https://github.com/miurla).
Morphic is licensed under the Apache License 2.0 (Copyright 2024 Yoshiki Miura).
Wasel adds Arabic localization, multi-provider LLM support, tiered
authentication, Redis-backed rate limiting, and dual-layer storage on top of
that foundation. See the [NOTICE](NOTICE) file for attribution details.
