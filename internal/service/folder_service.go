package service

import (
	"context"
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

func (s *FolderService) GetAlbums(ctx context.Context, folderID string) ([]*models.Album, error) {
	return s.repo.GetAlbumsByFolderID(ctx, folderID)
}

func (s *FolderService) OverwriteUserTree(ctx context.Context, userID string, tree []*models.FolderTree) error {
	// Simple implementation: delete all and recreate
	// Ideally this should be in a transaction
	folders, _ := s.repo.GetFoldersByUserID(ctx, userID)
	for _, f := range folders {
		s.repo.DeleteFolder(ctx, f.ID)
	}

	var saveNode func(node *models.FolderTree, parentID *string, pos int) error
	saveNode = func(node *models.FolderTree, parentID *string, pos int) error {
		f := &models.Folder{
			ID:         node.ID,
			UserID:     userID,
			ParentID:   parentID,
			Name:       node.Name,
			IsExpanded: node.IsExpanded,
			Position:   pos,
		}
		if err := s.repo.CreateFolder(ctx, f); err != nil {
			return err
		}

		for i, album := range node.Albums {
			album.UserID = userID
			album.FolderID = node.ID
			album.Position = i
			if err := s.repo.AddAlbum(ctx, album); err != nil {
				return err
			}
		}

		for i, sub := range node.Subfolders {
			if err := saveNode(sub, &node.ID, i); err != nil {
				return err
			}
		}
		return nil
	}

	for i, node := range tree {
		if err := saveNode(node, nil, i); err != nil {
			return err
		}
	}

	return nil
}
