package handlers

import (
	"net/http"
	"github.com/go-chi/chi/v5"
	"github.com/user/album-shelf/internal/service"
	"github.com/user/album-shelf/internal/models"
	"github.com/user/album-shelf/templates"
)

type AppHandler struct {
	folderService *service.FolderService
	searchService *service.SearchService
}

func NewAppHandler(fs *service.FolderService, ss *service.SearchService) *AppHandler {
	return &AppHandler{folderService: fs, searchService: ss}
}

func (h *AppHandler) Index(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r)
	folders, _ := h.folderService.GetUserTree(r.Context(), userID)

	selectedFolderID := ""
	if len(folders) > 0 {
		selectedFolderID = folders[0].ID
	}

	templates.Dashboard(folders, selectedFolderID).Render(r.Context(), w)
}

func (h *AppHandler) ShowLogin(w http.ResponseWriter, r *http.Request) {
	templates.Login().Render(r.Context(), w)
}

func (h *AppHandler) GetFolderAlbums(w http.ResponseWriter, r *http.Request) {
	folderID := chi.URLParam(r, "id")
	albums, _ := h.folderService.GetAlbums(r.Context(), folderID)
	templates.AlbumGrid(albums).Render(r.Context(), w)
}

func (h *AppHandler) CreateFolder(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r)
	name := r.FormValue("name")
	if name == "" {
		name = "New Collection"
	}

	folder, _ := h.folderService.CreateFolder(r.Context(), userID, name, nil)

	allFolders, _ := h.folderService.GetUserTree(r.Context(), userID)
	templates.FolderItem(folder, allFolders, folder.ID).Render(r.Context(), w)
}

func (h *AppHandler) RemoveAlbum(w http.ResponseWriter, r *http.Request) {
	albumID := chi.URLParam(r, "id")
	h.folderService.RemoveAlbum(r.Context(), albumID)
	w.WriteHeader(http.StatusOK)
}

func (h *AppHandler) ToggleFolder(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r)
	folderID := chi.URLParam(r, "id")

	h.folderService.ToggleFolder(r.Context(), folderID)

	allFolders, _ := h.folderService.GetUserTree(r.Context(), userID)
	selectedFolderID := "" // You might want to track this
	templates.FolderTree(allFolders, selectedFolderID).Render(r.Context(), w)
}

func (h *AppHandler) SelectFolder(w http.ResponseWriter, r *http.Request) {
	folderID := chi.URLParam(r, "id")
	albums, _ := h.folderService.GetAlbums(r.Context(), folderID)
	templates.AlbumGrid(albums).Render(r.Context(), w)
}

func (h *AppHandler) ReorderAlbums(w http.ResponseWriter, r *http.Request) {
	// SortableJS sends multiple 'album_id' fields in order
	r.ParseForm()
	albumIDs := r.Form["album_id"]
	// Update positions in DB
	for i, id := range albumIDs {
		_ = i
		_ = id
		// h.folderService.UpdateAlbumPosition(...)
	}
	w.WriteHeader(http.StatusOK)
}

func (h *AppHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	folderID := r.URL.Query().Get("folder_id")
	if query == "" {
		w.WriteHeader(http.StatusOK)
		return
	}

	results := []service.SearchResult{}

	// Apple
	if appleResults, err := h.searchService.SearchApple(query); err == nil {
		results = append(results, appleResults...)
	}

	// Deezer
	if deezerResults, err := h.searchService.SearchDeezer(query); err == nil {
		results = append(results, deezerResults...)
	}

	// Spotify
	if spotifyResults, err := h.searchService.SearchSpotify(query); err == nil {
		results = append(results, spotifyResults...)
	}

	templates.SearchResults(results, folderID).Render(r.Context(), w)
}

func (h *AppHandler) AddAlbum(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r)

	folderID := r.FormValue("folder_id")
	if folderID == "" {
		folders, _ := h.folderService.GetUserTree(r.Context(), userID)
		if len(folders) == 0 {
			http.Error(w, "No folder found", http.StatusBadRequest)
			return
		}
		folderID = folders[0].ID
	}

	album := &models.Album{
		ID:          r.FormValue("id"),
		UserID:      userID,
		FolderID:    folderID,
		Name:        r.FormValue("name"),
		Artist:      r.FormValue("artist"),
		ImageUrl:    r.FormValue("imageUrl"),
		ExternalUrl: stringPtr(r.FormValue("externalUrl")),
	}

	h.folderService.AddAlbum(r.Context(), album)
	templates.AlbumCard(album).Render(r.Context(), w)
}

func stringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
