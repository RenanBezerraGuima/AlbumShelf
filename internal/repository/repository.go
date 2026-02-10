package repository

import (
	"context"
	"github.com/user/album-shelf/internal/models"
)

type Repository interface {
	// Folders
	CreateFolder(ctx context.Context, folder *models.Folder) error
	GetFolderByID(ctx context.Context, id string) (*models.Folder, error)
	GetFoldersByUserID(ctx context.Context, userID string) ([]*models.Folder, error)
	UpdateFolder(ctx context.Context, folder *models.Folder) error
	DeleteFolder(ctx context.Context, id string) error

	// Albums
	AddAlbum(ctx context.Context, album *models.Album) error
	GetAlbumsByFolderID(ctx context.Context, folderID string) ([]*models.Album, error)
	RemoveAlbum(ctx context.Context, albumID string) error
	UpdateAlbumPosition(ctx context.Context, albumID string, folderID string, position int) error

	// Transactions
	InTransaction(ctx context.Context, fn func(repo Repository) error) error
}
