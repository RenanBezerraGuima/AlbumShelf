package models

type Folder struct {
	ID         string    `db:"id" json:"id"`
	UserID     string    `db:"user_id" json:"userId"`
	ParentID   *string   `db:"parent_id" json:"parentId"`
	Name       string    `db:"name" json:"name"`
	IsExpanded bool      `db:"is_expanded" json:"isExpanded"`
	Position   int       `db:"position" json:"position"`
}

type Album struct {
	ID          string    `db:"id" json:"id"`
	FolderID    string    `db:"folder_id" json:"folderId"`
	UserID      string    `db:"user_id" json:"userId"`
	SpotifyID   *string   `db:"spotify_id" json:"spotifyId"`
	Name        string    `db:"name" json:"name"`
	Artist      string    `db:"artist" json:"artist"`
	ImageUrl    string    `db:"image_url" json:"imageUrl"`
	ReleaseDate *string   `db:"release_date" json:"releaseDate"`
	TotalTracks int       `db:"total_tracks" json:"totalTracks"`
	ExternalUrl *string   `db:"external_url" json:"externalUrl"`
	Position    int       `db:"position" json:"position"`
}

type FolderTree struct {
	ID         string        `json:"id"`
	Name       string        `json:"name"`
	ParentID   *string       `json:"parentId"`
	Albums     []*Album      `json:"albums"`
	Subfolders []*FolderTree `json:"subfolders"`
	IsExpanded bool          `json:"isExpanded"`
}
