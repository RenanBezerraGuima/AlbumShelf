# ALBUMSHELF [VER. 1.0.0]
> HIGH-SPEED LOCAL-FIRST ALBUM ORGANIZATION SYSTEM.

AlbumShelf is a brutalist, industrial-grade web application designed for collectors who value speed, privacy, and data ownership. Search the global catalog, organize your library into hierarchical collections, and keep your data exactly where it belongs: with you.

## KEY SYSTEMS

- **ACCOUNT SYNC**: Sign in with Supabase email auth and keep your shelf synced across machines.
- **HIERARCHICAL COLLECTIONS**: Organize your music into deeply nested structures. Rename, move, and reorder with ease.
- **DRAG & DROP INTERFACE**: Seamlessly manage your library using a low-latency drag-and-drop system for both albums and collections.
- **DATA PORTABILITY**: Export your entire database to JSON and import it back instantly. Your data is never locked in.
- **BRUTALIST INDUSTRIAL UI**: A high-contrast, technical aesthetic featuring monochrome tones, neon lime accents, and monospaced typography.

## SUPPORTED PROVIDERS

AlbumShelf integrates with multiple streaming services to provide a comprehensive search experience:

- **APPLE MUSIC**: Search the entire iTunes Search API catalog. No configuration required.
- **DEEZER**: Access millions of tracks via the Deezer search engine. No configuration required.
- **SPOTIFY**: Full Spotify catalog search. Requires a Spotify Developer Client ID (see [Spotify Integration](#spotify-integration)).

## GETTING STARTED

### PREREQUISITES
- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)

### DEPLOYMENT & DEVELOPMENT
1. **CLONE REPOSITORY**:
   ```bash
   git clone https://github.com/your-username/album-shelf.git
   cd album-shelf
   ```

2. **INSTALL DEPENDENCIES**:
   ```bash
   pnpm install
   ```

3. **EXECUTE DEVELOPMENT SERVER**:
   ```bash
   pnpm dev
   ```

4. **ACCESS INTERFACE**:
   Open [http://localhost:3000/AlbumShelf/](http://localhost:3000/AlbumShelf/) in your browser.

## SUPABASE SETUP

This project now expects Supabase for authentication and user data sync.

1. Create a Supabase project.
2. In the SQL editor, run [docs/supabase-schema.sql](docs/supabase-schema.sql).
3. Enable Email auth in Supabase Authentication.
4. Configure these environment variables:
   ```env
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
     DEEZER_ARL_ENCRYPTION_KEY=base64_32_byte_secret
   ```
5. Add your deployment URL to the Supabase auth redirect allow-list.

### DEEZER ACCOUNT SYNC

AlbumShelf supports a server-side Deezer account connection for private playlist
and album sync experiments. This uses the user's own Deezer browser session ARL
and stores it encrypted in Supabase. The ARL is never exposed through client
state, share links, or API responses.

1. Generate an encryption key:
   ```bash
   openssl rand -base64 32
   ```
2. Set `DEEZER_ARL_ENCRYPTION_KEY` in local development and in Vercel
   environment variables.
3. Run the latest `docs/supabase-schema.sql` so the `deezer_connections` table
   and row-level policies exist.
4. Use `POST /api/deezer/connection` with a Supabase bearer token to connect,
   `GET /api/deezer/connection` to check status, and
   `DELETE /api/deezer/connection` to disconnect.

## SPOTIFY INTEGRATION

To enable Spotify search functionality, you must provide a Client ID from the Spotify Developer Dashboard:

1. **CREATE APP**: Visit the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create a new application.
2. **GET CLIENT ID**: Copy your **Client ID**.
3. **CONFIGURE REDIRECT URIS**: Add the following URIs to your app settings (include the trailing slash):
   - `http://localhost:3000/AlbumShelf/` (Local Development)
   - `https://<your-username>.github.io/AlbumShelf/` (Production)
4. **SET ENVIRONMENT VARIABLES**:
   - **Local**: Create a `.env.local` file:
     ```env
     NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id_here
     ```
   - **Production (Vercel)**: Add `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` in the Vercel project environment variables.

## TECHNICAL SPECIFICATIONS

- **FRAMEWORK**: [Next.js](https://nextjs.org/) (App Router, Static Export)
- **STATE MANAGEMENT**: [Zustand](https://github.com/pmndrs/zustand) + Persistence Middleware
- **STYLING**: [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
- **SECURITY**: Built-in URL and image sanitization; PKCE flow for Spotify authentication.
- **COMPLIANCE**: Fully accessible via ARIA patterns; Keyboard navigable.

## LICENSE

Licensed under the [GNU GPL-3.0 License](LICENSE).
