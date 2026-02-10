package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"

	"github.com/user/album-shelf/internal/handlers"
	"github.com/user/album-shelf/internal/repository/sqlite"
	"github.com/user/album-shelf/internal/service"
)

func main() {
	var db *sqlx.DB
	var err error

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		db, err = sqlx.Connect("postgres", dbURL)
		if err == nil {
			fmt.Println("Connected to PostgreSQL")
		}
	} else {
		db, err = sqlx.Connect("sqlite3", "albumshelf.db")
		if err == nil {
			fmt.Println("Using local SQLite database")
			// Enable foreign keys for SQLite
			db.MustExec("PRAGMA foreign_keys = ON")
		}
	}

	if err != nil {
		log.Fatal(err)
	}

	// Initialize schema
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY
	);

	CREATE TABLE IF NOT EXISTS folders (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		parent_id TEXT,
		name TEXT NOT NULL,
		is_expanded BOOLEAN DEFAULT TRUE,
		"position" INTEGER DEFAULT 0,
		FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS albums (
		id TEXT PRIMARY KEY,
		folder_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		spotify_id TEXT,
		spotify_url TEXT,
		name TEXT NOT NULL,
		artist TEXT NOT NULL,
		image_url TEXT NOT NULL,
		release_date TEXT,
		total_tracks INTEGER,
		external_url TEXT,
		"position" INTEGER DEFAULT 0,
		FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
	);`
	db.MustExec(schema)

	// Seed 'dev' user robustly
	_, err = db.Exec("INSERT INTO users (id) VALUES ('dev') ON CONFLICT (id) DO NOTHING")
	if err != nil {
		fmt.Printf("Initial seed failed: %v, attempting fallback...\n", err)
		// Try fallback with common columns if the previous one failed (e.g. NOT NULL constraints)
		_, errFallback := db.Exec("INSERT INTO users (id, email) VALUES ('dev', 'dev@example.com') ON CONFLICT (id) DO NOTHING")
		if errFallback != nil {
			fmt.Printf("Fallback seed also failed: %v. Database might be in an inconsistent state.\n", errFallback)
		} else {
			fmt.Println("Fallback seed successful.")
		}
	}

	// Ensure spotify_url exists for existing databases
	if dbURL != "" {
		// PostgreSQL
		db.Exec("ALTER TABLE albums ADD COLUMN IF NOT EXISTS spotify_url TEXT")
	} else {
		// SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we check if it exists first
		var count int
		db.Get(&count, "SELECT count(*) FROM pragma_table_info('albums') WHERE name='spotify_url'")
		if count == 0 {
			db.Exec("ALTER TABLE albums ADD COLUMN spotify_url TEXT")
		}
	}

	repo := sqlite.NewSQLiteRepository(db)
	folderService := service.NewFolderService(repo)

	authHandler := handlers.NewAuthHandler()
	apiHandler := handlers.NewAPIHandler(folderService)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Auth routes
	r.Get("/login", authHandler.ShowLogin)
	r.Post("/login", authHandler.Login)
	r.Get("/logout", authHandler.Logout)

	// API routes
	r.Group(func(r chi.Router) {
		r.Use(handlers.AuthMiddleware)
		r.Get("/api/data", apiHandler.GetData)
		r.Post("/api/data", apiHandler.SaveData)
	})

	// Protected UI and Static files
	r.Group(func(r chi.Router) {
		r.Use(handlers.AuthMiddleware)

		// Serve Next.js static export
		workDir, _ := os.Getwd()
		filesDir := http.Dir(os.Getenv("STATIC_DIR"))
		if os.Getenv("STATIC_DIR") == "" {
			filesDir = http.Dir(workDir + "/out")
		}

		fileServer := http.FileServer(filesDir)

		// Handle /AlbumShelf/ prefix if necessary, but we'll try to serve at root
		r.Handle("/*", fileServer)
	})

	// Static assets for the Go templates (like login page)
	goStatic := http.FileServer(http.Dir("./static"))
	r.Handle("/static/*", http.StripPrefix("/static", goStatic))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	fmt.Printf("Server starting on :%s\n", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
