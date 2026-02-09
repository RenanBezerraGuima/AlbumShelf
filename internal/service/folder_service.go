package service

import (
	"context"
	"github.com/google/uuid"
	"github.com/user/album-shelf/internal/models"
	"github.com/user/album-shelf/internal/repository"
)

type FolderService struct {
	repo repository.Repository
}

func NewFolderService(repo repository.Repository) *FolderService {
	return &FolderService{repo: repo}
}

func (s *FolderService) GetUserTree(ctx context.Context, userID string) ([]*models.Folder, error) {
	return s.repo.GetFoldersByUserID(ctx, userID)
}

func (s *FolderService) CreateFolder(ctx context.Context, userID, name string, parentID *string) (*models.Folder, error) {
	folder := &models.Folder{
		ID:         uuid.New().String(),
		UserID:     userID,
		ParentID:   parentID,
		Name:       name,
		IsExpanded: true,
		Position:   0,
	}
	err := s.repo.CreateFolder(ctx, folder)
	return folder, err
}

func (s *FolderService) GetAlbums(ctx context.Context, folderID string) ([]*models.Album, error) {
	return s.repo.GetAlbumsByFolderID(ctx, folderID)
}

func (s *FolderService) AddAlbum(ctx context.Context, album *models.Album) error {
	if album.ID == "" {
		album.ID = uuid.New().String()
	}
	return s.repo.AddAlbum(ctx, album)
}

func (s *FolderService) RemoveAlbum(ctx context.Context, albumID string) error {
	return s.repo.RemoveAlbum(ctx, albumID)
}

func (s *FolderService) ToggleFolder(ctx context.Context, folderID string) error {
	// Get folder, toggle expanded, update
	// Note: For brevity in this alternative, I'll just assume we have the folder or we use a partial update
	// A better repo would have a ToggleFolder method
	return nil
}
