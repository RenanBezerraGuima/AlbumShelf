# Hosted Deployment (Free Tier) + Cross-Device Sync

This guide adds a **second deployment** (while keeping GitHub Pages as a backup) and introduces a **hosted database** so your data syncs across devices. The recommended providers are:

- **Hosting:** Vercel (free hobby plan)
- **Database:** Supabase (free tier Postgres)

These work well with the existing Next.js static export setup and require minimal maintenance.

## 1) Hosting recommendation: Vercel

Vercel supports Next.js out of the box and makes it easy to attach environment variables for production.

**Steps**
1. Create a new Vercel project from this GitHub repository.
2. In **Project Settings → Environment Variables**, do **not** set `NEXT_PUBLIC_BASE_PATH`  
   (leave it unset so Vercel deploys at `/`).
3. When connecting the Supabase integration in Vercel:
   - Select **Development**, **Preview**, and **Production** environments.
   - Leave the **Custom Prefix** blank (so the default Supabase env vars are created).
4. For Spotify (if used), add:
   - `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`

> ✅ Keep GitHub Pages: do **not** remove your existing GitHub Actions deployment; this Vercel deploy is a second target.

## 2) Database recommendation: Supabase

Supabase provides a free Postgres database with a hosted REST/JS client. It’s an ideal fit for small personal datasets.

**Steps**
1. Create a new Supabase project (free tier).
2. Create a table for your album data (see **Suggested Schema** below).
3. Add the Supabase project keys to Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Auth + policies
Enable email/password auth in Supabase and add an RLS policy so each user only reads/writes their own data:

```sql
alter table public.albumshelf_items enable row level security;

create policy "User can manage their library"
on public.albumshelf_items
for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);
```

### Suggested schema
Create a table called `albumshelf_items`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `user_id` | `text` | **UNIQUE** Identifier (essential for automatic sync/upsert) |
| `data` | `jsonb` | Serialized library data |
| `updated_at` | `timestamptz` | default `now()` |

> ⚠️ **CRITICAL**: The `user_id` column MUST have a **UNIQUE** constraint for the automatic sync (upsert) to work. If you already created the table without it, run:
> `ALTER TABLE public.albumshelf_items ADD CONSTRAINT unique_user_id UNIQUE (user_id);`

This keeps the initial integration simple: store the entire library JSON as a single record, then evolve later.

## 3) App integration

The app includes a **Cloud Account** panel (top bar) that lets you:
1. Sign up / sign in with email + password.
2. Pull data from Supabase.
3. Push data to Supabase.

Auto-sync is enabled after the first successful load, with local-first behavior preserved.
