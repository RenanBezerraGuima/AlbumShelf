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
	return s.repo.InTransaction(ctx, func(txRepo repository.Repository) error {
		// Delete all existing folders and albums for this user
		// We rely on ON DELETE CASCADE for albums, but we need to delete folders
		folders, err := txRepo.GetFoldersByUserID(ctx, userID)
		if err != nil {
			return err
		}

		for _, f := range folders {
			if err := txRepo.DeleteFolder(ctx, f.ID); err != nil {
				return err
			}
		}

		var saveNode func(repo repository.Repository, node *models.FolderTree, parentID *string, pos int) error
		saveNode = func(repo repository.Repository, node *models.FolderTree, parentID *string, pos int) error {
			f := &models.Folder{
				ID:         node.ID,
				UserID:     userID,
				ParentID:   parentID,
				Name:       node.Name,
				IsExpanded: node.IsExpanded,
				Position:   pos,
			}
			if err := repo.CreateFolder(ctx, f); err != nil {
				return err
			}

			for i, album := range node.Albums {
				album.UserID = userID
				album.FolderID = node.ID
				album.Position = i
				if err := repo.AddAlbum(ctx, album); err != nil {
					return err
				}
			}

			for i, sub := range node.Subfolders {
				if err := saveNode(repo, sub, &node.ID, i); err != nil {
					return err
				}
			}
			return nil
		}

		for i, node := range tree {
			if err := saveNode(txRepo, node, nil, i); err != nil {
				return err
			}
		}

		return nil
	})
}
