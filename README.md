# ALBUMSHELF ONLINE [VER. 1.0.0]
> EXPERIMENTAL GO + HTMX ALTERNATIVE.

AlbumShelf Online is the high-performance, server-side sibling of the original local-first system. It features a technical, brutalist aesthetic powered by a clean Go backend and dynamic HTMX frontend.

## KEY SYSTEMS

- **SERVER-SIDE ACCOUNTS**: Synchronize your library across devices. Your data is stored securely in a SQLite/PostgreSQL database.
- **GO + HTMX STACK**: Low-bloat, high-performance architecture using Go for logic and HTMX for seamless, single-page-like interactions.
- **BRUTALIST INDUSTRIAL UI**: A high-contrast aesthetic featuring monochrome tones and neon lime accents.
- **DRAG & DROP**: Seamless collection management powered by SortableJS.

## SUPPORTED PROVIDERS

- **APPLE MUSIC**: Direct integration. No configuration required.
- **DEEZER**: Global search via Deezer API.
- **SPOTIFY**: Optional. Requires `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` environment variables.

## GETTING STARTED

### PREREQUISITES
- [Go](https://go.dev/) (v1.24+)
- [Templ](https://templ.guide/) (`go install github.com/a-h/templ/cmd/templ@latest`)

### LOCAL DEVELOPMENT
1. **INSTALL DEPENDENCIES**:
   ```bash
   go mod tidy
   ```

2. **GENERATE TEMPLATES**:
   ```bash
   templ generate
   ```

3. **RUN SERVER**:
   ```bash
   go run cmd/server/main.go
   ```

4. **ACCESS**:
   Open [http://localhost:3000](http://localhost:3000)

## DEPLOYMENT

This version is optimized for containerized deployment (e.g., Render, Railway, Fly.io).

1. Set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` (optional).
2. The `Dockerfile` handles template generation and building.

## LICENSE

Licensed under the [GNU GPL-3.0 License](LICENSE).
