# Supabase Setup

Wasel uses [Supabase](https://supabase.com/) for authentication, the
application database (conversations, messages, profiles, subscriptions,
documents/RAG, usage logging, Stripe webhook events), and file storage.

A fresh Supabase project only contains the built-in `auth` and `storage`
schemas — the application schema must be applied once from
[`supabase/migrations/0001_initial_schema.sql`](../supabase/migrations/0001_initial_schema.sql).

## 1. Create a project

Create a project at [database.new](https://database.new) (the free tier
works). From **Project Settings → API**, copy into your `.env.local`:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Apply the schema

**Option A — SQL Editor (simplest).** Open **SQL Editor** in the Supabase
dashboard, paste the contents of
`supabase/migrations/0001_initial_schema.sql`, and run it.

**Option B — Supabase CLI.**

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

The migration creates:

| Object | Purpose |
| --- | --- |
| `profiles` | One row per auth user, auto-created by the `handle_new_user` trigger on `auth.users` |
| `conversations`, `messages` | Chat history; rows with a non-null `share_path` are publicly readable |
| `documents`, `document_chunks` | Uploaded files and their pgvector embeddings (768-dim) for RAG |
| `subscriptions`, `stripe_events`, `usage_log` | Billing state, raw Stripe webhooks, rate-limit accounting |
| `match_document_chunks()` | Cosine-similarity search used by the RAG retrieval path |
| `rls_auto_enable` event trigger | Safety net that enables RLS on any new `public` table |
| `file-uploads`, `files-preview` buckets | Private storage buckets with per-user access policies |

Every table has Row Level Security enabled with owner-scoped policies
(`user_id = auth.uid()`), plus read-only public-share policies on
`conversations`/`messages` for rows where `share_path is not null`.

> **Note:** the `vector` (pgvector) extension is intentionally installed into
> the **`public`** schema — the `<=>` cosine operator is referenced
> unqualified by `match_document_chunks` and the HNSW index. Don't move it to
> the `extensions` schema.

> **Troubleshooting:** if `create policy ... on storage.objects` or
> `create event trigger` fails with a permissions error on your project,
> create the storage policies via **Dashboard → Storage → Policies** instead,
> and skip the `ensure_rls` event trigger (it is a safety net, not required
> for the app to function).

## 3. Configure auth

In **Authentication → Providers**, enable **Email** (and optionally
**Google** for social login). For production, configure your site URL and
redirect URLs under **Authentication → URL Configuration**.

CAPTCHA (Cloudflare Turnstile) is optional — see the
[README](../README.md#%EF%B8%8F-configuration).

## 4. Optional: document-processing webhooks (Vault)

Uploads to the storage buckets fire the `handle_storage_upload_router`
trigger, which forwards the new object to document-processing Edge Functions
(`on-document-upload`, `on-document-upload-preview`). The trigger reads its
configuration from [Supabase Vault](https://supabase.com/docs/guides/database/vault)
and **silently no-ops when the secrets are absent**, so plain file uploads
work without any of this.

To enable it, run in the SQL Editor (with your own values — never commit
these):

```sql
select vault.create_secret('https://<your-project-ref>.supabase.co', 'project_url');
select vault.create_secret('<your-service-role-key>', 'service_role_key');
```

and deploy the corresponding Edge Functions to your project.
