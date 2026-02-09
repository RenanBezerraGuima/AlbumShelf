package models

import "time"

type User struct {
	ID           string    `db:"id" json:"id"`
	Email        string    `db:"email" json:"email"`
	PasswordHash string    `db:"password_hash" json:"-"`
	Theme        string    `db:"theme" json:"theme"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type Folder struct {
	ID         string    `db:"id" json:"id"`
	UserID     string    `db:"user_id" json:"user_id"`
	ParentID   *string   `db:"parent_id" json:"parent_id"`
	Name       string    `db:"name" json:"name"`
	IsExpanded bool      `db:"is_expanded" json:"is_expanded"`
	Position   int       `db:"position" json:"position"`
}

type Album struct {
	ID          string    `db:"id" json:"id"`
	FolderID    string    `db:"folder_id" json:"folder_id"`
	UserID      string    `db:"user_id" json:"user_id"`
	SpotifyID   *string   `db:"spotify_id" json:"spotify_id"`
	Name        string    `db:"name" json:"name"`
	Artist      string    `db:"artist" json:"artist"`
	ImageUrl    string    `db:"image_url" json:"image_url"`
	ReleaseDate *string   `db:"release_date" json:"release_date"`
	TotalTracks int       `db:"total_tracks" json:"total_tracks"`
	ExternalUrl *string   `db:"external_url" json:"external_url"`
	Position    int       `db:"position" json:"position"`
}
