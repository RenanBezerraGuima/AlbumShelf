package handlers

import (
	"encoding/json"
	"net/http"
	"github.com/user/album-shelf/internal/service"
	"github.com/user/album-shelf/internal/models"
)

type APIHandler struct {
	folderService *service.FolderService
}

func NewAPIHandler(fs *service.FolderService) *APIHandler {
	return &APIHandler{folderService: fs}
}

type SyncData struct {
	Folders []*models.FolderTree `json:"folders"`
}

func (h *APIHandler) GetData(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r)

	// Get all folders and albums and reconstruct the tree
	folders, _ := h.folderService.GetUserTree(r.Context(), userID)

	// Create a map for easy lookup
	folderMap := make(map[string]*models.FolderTree)
	var rootFolders []*models.FolderTree

	for _, f := range folders {
		ft := &models.FolderTree{
			ID:         f.ID,
			Name:       f.Name,
			ParentID:   f.ParentID,
			IsExpanded: f.IsExpanded,
			Subfolders: []*models.FolderTree{},
			Albums:     []*models.Album{},
		}
		folderMap[f.ID] = ft

		// Fetch albums for this folder
		albums, _ := h.folderService.GetAlbums(r.Context(), f.ID)
		if albums == nil {
			albums = []*models.Album{}
		}
		ft.Albums = albums
	}

	for _, ft := range folderMap {
		if ft.ParentID == nil || *ft.ParentID == "" {
			rootFolders = append(rootFolders, ft)
		} else {
			if parent, ok := folderMap[*ft.ParentID]; ok {
				parent.Subfolders = append(parent.Subfolders, ft)
			} else {
				// Parent not found, treat as root
				rootFolders = append(rootFolders, ft)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SyncData{Folders: rootFolders})
}

func (h *APIHandler) SaveData(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r)

	var data SyncData
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// We'll use a transaction to clear and save
	// For now, let's just implement a simple clear-and-save in the service
	err := h.folderService.OverwriteUserTree(r.Context(), userID, data.Folders)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
