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
3. For Spotify (if used), add:
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

### Suggested schema
Create a table called `albumshelf_items`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `user_id` | `text` | Identifier for a device or user (optional, if you add auth later) |
| `data` | `jsonb` | Serialized library data |
| `updated_at` | `timestamptz` | default `now()` |

This keeps the initial integration simple: store the entire library JSON as a single record, then evolve later.

## 3) Next step (implementation)

To actually sync data, you’ll add a small data layer that:
1. Reads from Supabase on load.
2. Writes to Supabase on save/export.
3. Falls back to `localStorage` when offline.

If you want, I can implement the Supabase client and wire it to the existing data store while keeping the local-first behavior.
