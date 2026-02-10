package sqlite

import (
	"context"
	"database/sql"

	"github.com/jmoiron/sqlx"
	"github.com/user/album-shelf/internal/models"
	"github.com/user/album-shelf/internal/repository"
)

type dbOrTx interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	GetContext(ctx context.Context, dest interface{}, query string, args ...interface{}) error
	SelectContext(ctx context.Context, dest interface{}, query string, args ...interface{}) error
	NamedExecContext(ctx context.Context, query string, arg interface{}) (sql.Result, error)
	Rebind(query string) string
}

type SQLiteRepository struct {
	db *sqlx.DB
	tx *sqlx.Tx
}

func NewSQLiteRepository(db *sqlx.DB) *SQLiteRepository {
	return &SQLiteRepository{db: db}
}

func (r *SQLiteRepository) ext() dbOrTx {
	if r.tx != nil {
		return r.tx
	}
	return r.db
}

func (r *SQLiteRepository) CreateFolder(ctx context.Context, folder *models.Folder) error {
	_, err := r.ext().NamedExecContext(ctx, `
		INSERT INTO folders (id, user_id, parent_id, name, is_expanded, position)
		VALUES (:id, :user_id, :parent_id, :name, :is_expanded, :position)
	`, folder)
	return err
}

func (r *SQLiteRepository) GetFolderByID(ctx context.Context, id string) (*models.Folder, error) {
	var folder models.Folder
	err := r.ext().GetContext(ctx, &folder, r.ext().Rebind("SELECT * FROM folders WHERE id = ?"), id)
	return &folder, err
}

func (r *SQLiteRepository) GetFoldersByUserID(ctx context.Context, userID string) ([]*models.Folder, error) {
	var folders []*models.Folder
	err := r.ext().SelectContext(ctx, &folders, r.ext().Rebind("SELECT * FROM folders WHERE user_id = ? ORDER BY position ASC"), userID)
	return folders, err
}

func (r *SQLiteRepository) UpdateFolder(ctx context.Context, folder *models.Folder) error {
	_, err := r.ext().NamedExecContext(ctx, `
		UPDATE folders SET name = :name, is_expanded = :is_expanded, position = :position, parent_id = :parent_id
		WHERE id = :id
	`, folder)
	return err
}

func (r *SQLiteRepository) DeleteFolder(ctx context.Context, id string) error {
	_, err := r.ext().ExecContext(ctx, r.ext().Rebind("DELETE FROM folders WHERE id = ?"), id)
	return err
}

func (r *SQLiteRepository) AddAlbum(ctx context.Context, album *models.Album) error {
	_, err := r.ext().NamedExecContext(ctx, `
		INSERT INTO albums (id, folder_id, user_id, spotify_id, name, artist, image_url, release_date, total_tracks, external_url, position)
		VALUES (:id, :folder_id, :user_id, :spotify_id, :name, :artist, :image_url, :release_date, :total_tracks, :external_url, :position)
	`, album)
	return err
}

func (r *SQLiteRepository) GetAlbumsByFolderID(ctx context.Context, folderID string) ([]*models.Album, error) {
	var albums []*models.Album
	err := r.ext().SelectContext(ctx, &albums, r.ext().Rebind("SELECT * FROM albums WHERE folder_id = ? ORDER BY position ASC"), folderID)
	return albums, err
}

func (r *SQLiteRepository) RemoveAlbum(ctx context.Context, albumID string) error {
	_, err := r.ext().ExecContext(ctx, r.ext().Rebind("DELETE FROM albums WHERE id = ?"), albumID)
	return err
}

func (r *SQLiteRepository) UpdateAlbumPosition(ctx context.Context, albumID string, folderID string, position int) error {
	_, err := r.ext().ExecContext(ctx, r.ext().Rebind("UPDATE albums SET folder_id = ?, position = ? WHERE id = ?"), folderID, position, albumID)
	return err
}

func (r *SQLiteRepository) InTransaction(ctx context.Context, fn func(repo repository.Repository) error) error {
	if r.tx != nil {
		return fn(r)
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		}
	}()

	repoWithTx := &SQLiteRepository{
		db: r.db,
		tx: tx,
	}

	if err := fn(repoWithTx); err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}
