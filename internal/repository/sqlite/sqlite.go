package sqlite

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jmoiron/sqlx"
	"github.com/user/album-shelf/internal/models"
)

type SQLiteRepository struct {
	db *sqlx.DB
}

func NewSQLiteRepository(db *sqlx.DB) *SQLiteRepository {
	return &SQLiteRepository{db: db}
}

func (r *SQLiteRepository) CreateUser(ctx context.Context, user *models.User) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO users (id, email, password_hash, theme)
		VALUES (:id, :email, :password_hash, :theme)
	`, user)
	return err
}

func (r *SQLiteRepository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.db.GetContext(ctx, &user, "SELECT * FROM users WHERE email = ?", email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *SQLiteRepository) GetUserByID(ctx context.Context, id string) (*models.User, error) {
	var user models.User
	err := r.db.GetContext(ctx, &user, "SELECT * FROM users WHERE id = ?", id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *SQLiteRepository) UpdateUserTheme(ctx context.Context, userID, theme string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE users SET theme = ? WHERE id = ?", theme, userID)
	return err
}

func (r *SQLiteRepository) CreateFolder(ctx context.Context, folder *models.Folder) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO folders (id, user_id, parent_id, name, is_expanded, position)
		VALUES (:id, :user_id, :parent_id, :name, :is_expanded, :position)
	`, folder)
	return err
}

func (r *SQLiteRepository) GetFoldersByUserID(ctx context.Context, userID string) ([]*models.Folder, error) {
	var folders []*models.Folder
	err := r.db.SelectContext(ctx, &folders, "SELECT * FROM folders WHERE user_id = ? ORDER BY position ASC", userID)
	return folders, err
}

func (r *SQLiteRepository) UpdateFolder(ctx context.Context, folder *models.Folder) error {
	_, err := r.db.NamedExecContext(ctx, `
		UPDATE folders SET name = :name, is_expanded = :is_expanded, position = :position, parent_id = :parent_id
		WHERE id = :id
	`, folder)
	return err
}

func (r *SQLiteRepository) DeleteFolder(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM folders WHERE id = ?", id)
	return err
}

func (r *SQLiteRepository) AddAlbum(ctx context.Context, album *models.Album) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO albums (id, folder_id, user_id, spotify_id, name, artist, image_url, release_date, total_tracks, external_url, position)
		VALUES (:id, :folder_id, :user_id, :spotify_id, :name, :artist, :image_url, :release_date, :total_tracks, :external_url, :position)
	`, album)
	return err
}

func (r *SQLiteRepository) GetAlbumsByFolderID(ctx context.Context, folderID string) ([]*models.Album, error) {
	var albums []*models.Album
	err := r.db.SelectContext(ctx, &albums, "SELECT * FROM albums WHERE folder_id = ? ORDER BY position ASC", folderID)
	return albums, err
}

func (r *SQLiteRepository) RemoveAlbum(ctx context.Context, albumID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM albums WHERE id = ?", albumID)
	return err
}

func (r *SQLiteRepository) UpdateAlbumPosition(ctx context.Context, albumID string, folderID string, position int) error {
	_, err := r.db.ExecContext(ctx, "UPDATE albums SET folder_id = ?, position = ? WHERE id = ?", folderID, position, albumID)
	return err
}
