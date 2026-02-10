package sqlite

import (
	"context"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/user/album-shelf/internal/models"
)

func setupTestDB(t *testing.T) (*sqlx.DB, *SQLiteRepository) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}

	schema := `
	CREATE TABLE users (
		id TEXT PRIMARY KEY
	);

	INSERT INTO users (id) VALUES ('dev');

	CREATE TABLE folders (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		parent_id TEXT,
		name TEXT NOT NULL,
		is_expanded BOOLEAN DEFAULT TRUE,
		"position" INTEGER DEFAULT 0,
		FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
	);

	CREATE TABLE albums (
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
	repo := NewSQLiteRepository(db)
	return db, repo
}

func TestFolders(t *testing.T) {
	_, repo := setupTestDB(t)
	ctx := context.Background()

	folder := &models.Folder{
		ID:     "folder-1",
		UserID: "dev",
		Name:   "Favorites",
	}

	err := repo.CreateFolder(ctx, folder)
	assert.NoError(t, err)

	folders, err := repo.GetFoldersByUserID(ctx, "dev")
	assert.NoError(t, err)
	assert.Len(t, folders, 1)
	assert.Equal(t, "Favorites", folders[0].Name)
}

func TestAlbums(t *testing.T) {
	_, repo := setupTestDB(t)
	ctx := context.Background()

	folder := &models.Folder{ID: "folder-1", UserID: "dev", Name: "Favorites"}
	repo.CreateFolder(ctx, folder)

	album := &models.Album{
		ID:       "album-1",
		FolderID: "folder-1",
		UserID:   "dev",
		Name:     "Discovery",
		Artist:   "Daft Punk",
		ImageUrl: "http://example.com/cover.jpg",
	}

	err := repo.AddAlbum(ctx, album)
	assert.NoError(t, err)

	albums, err := repo.GetAlbumsByFolderID(ctx, "folder-1")
	assert.NoError(t, err)
	assert.Len(t, albums, 1)
	assert.Equal(t, "Discovery", albums[0].Name)

	err = repo.RemoveAlbum(ctx, "album-1")
	assert.NoError(t, err)
	albums, _ = repo.GetAlbumsByFolderID(ctx, "folder-1")
	assert.Len(t, albums, 0)
}

func TestDeleteUserFolders(t *testing.T) {
	_, repo := setupTestDB(t)
	ctx := context.Background()

	folder := &models.Folder{ID: "folder-1", UserID: "dev", Name: "Favorites"}
	repo.CreateFolder(ctx, folder)

	album := &models.Album{
		ID:       "album-1",
		FolderID: "folder-1",
		UserID:   "dev",
		Name:     "Discovery",
		Artist:   "Daft Punk",
		ImageUrl: "http://example.com/cover.jpg",
	}
	repo.AddAlbum(ctx, album)

	err := repo.DeleteUserFolders(ctx, "dev")
	assert.NoError(t, err)

	folders, _ := repo.GetFoldersByUserID(ctx, "dev")
	assert.Len(t, folders, 0)

	albums, _ := repo.GetAlbumsByFolderID(ctx, "folder-1")
	assert.Len(t, albums, 0)
}
