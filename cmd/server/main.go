package main

import (
	"fmt"
	"net/http"
	"log"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"

	"github.com/user/album-shelf/internal/handlers"
	"github.com/user/album-shelf/internal/repository/sqlite"
	"github.com/user/album-shelf/internal/service"
)

func main() {
	db, err := sqlx.Open("sqlite3", "albumshelf.db")
	if err != nil {
		log.Fatal(err)
	}

	// Initialize schema
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		theme TEXT DEFAULT 'industrial',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS folders (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		parent_id TEXT,
		name TEXT NOT NULL,
		is_expanded BOOLEAN DEFAULT TRUE,
		position INTEGER DEFAULT 0,
		FOREIGN KEY (user_id) REFERENCES users(id),
		FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS albums (
		id TEXT PRIMARY KEY,
		folder_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		spotify_id TEXT,
		name TEXT NOT NULL,
		artist TEXT NOT NULL,
		image_url TEXT NOT NULL,
		release_date TEXT,
		total_tracks INTEGER,
		external_url TEXT,
		position INTEGER DEFAULT 0,
		FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id)
	);`
	db.MustExec(schema)

	repo := sqlite.NewSQLiteRepository(db)
	userService := service.NewUserService(repo)
	folderService := service.NewFolderService(repo)

	spotifyID := os.Getenv("SPOTIFY_CLIENT_ID")
	spotifySecret := os.Getenv("SPOTIFY_CLIENT_SECRET")
	searchService := service.NewSearchService(spotifyID, spotifySecret)

	authHandler := handlers.NewAuthHandler(userService)
	appHandler := handlers.NewAppHandler(folderService, searchService)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Auth routes
	r.Get("/login", appHandler.ShowLogin)
	r.Post("/login", authHandler.Login)
	r.Get("/signup", appHandler.ShowSignup)
	r.Post("/signup", authHandler.Signup)
	r.Get("/logout", authHandler.Logout)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(handlers.AuthMiddleware)
		r.Get("/", appHandler.Index)
		r.Get("/search", appHandler.Search)
		r.Post("/albums", appHandler.AddAlbum)
		r.Post("/albums/reorder", appHandler.ReorderAlbums)
		r.Post("/folders", appHandler.CreateFolder)
		r.Get("/folders/{id}", appHandler.SelectFolder)
		r.Get("/folders/{id}/albums", appHandler.GetFolderAlbums)
		r.Post("/folders/{id}/toggle", appHandler.ToggleFolder)
		r.Delete("/albums/{id}", appHandler.RemoveAlbum)
	})

	// Static files
	fileServer := http.FileServer(http.Dir("./static"))
	r.Handle("/static/*", http.StripPrefix("/static", fileServer))

	fmt.Println("Server starting on :3000")
	if err := http.ListenAndServe(":3000", r); err != nil {
		log.Fatal(err)
	}
}
