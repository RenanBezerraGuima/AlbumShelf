# AlbumShelf

A fast, local-first album organizer. Search for your favorite albums, organize them into collections, and keep your data stored locally in your browser.

## Features
- **Search**: Discover albums on multiple streaming platforms using the built-in search.
- **Collections**: Organize your music into a hierarchical folder structure.
- **Local-First**: All your data stays in your browser's local storage—no account or backend required.
- **Brutalist Industrial UI**: A monochrome (black/white/gray) aesthetic with neon lime accents, dot grid backgrounds, thick borders, sharp corners, and monospaced technical typography.
- **Privacy Focused**: No tracking, no analytics, no external data harvesting.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/album-shelf.git
   cd album-shelf
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000/album-shelf/](http://localhost:3000/album-shelf/) in your browser.

### Spotify Integration
To enable Spotify search, you need to provide a Spotify Client ID:
1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Create a new App and get your **Client ID**.
3. Add `http://localhost:3000/AlbumShelf/` (and your production URL, e.g., `https://<user>.github.io/AlbumShelf/`) to the **Redirect URIs** in your app settings.
4. For local development, create a `.env.local` file in the root directory and add:
   ```env
   NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id_here
   ```
5. For GitHub Pages deployment, add a Repository Variable named `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` with your client ID.
   *(Note: The application uses the PKCE flow, so you do not need to enable "Implicit Grant" in the Spotify Dashboard.)*

## Deployment
This project is designed to be hosted as a static site on GitHub Pages.

To build the project:
```bash
pnpm build
```
The output will be in the `out/` directory.

## License
This project is licensed under the GNU GPL v3.0 - see the [LICENSE](LICENSE) file for details.
