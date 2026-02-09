package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/user/album-shelf/internal/models"
)

type mockRepo struct {
	users map[string]*models.User
}

func (m *mockRepo) CreateUser(ctx context.Context, user *models.User) error {
	m.users[user.Email] = user
	return nil
}

func (m *mockRepo) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	return m.users[email], nil
}

func (m *mockRepo) GetUserByID(ctx context.Context, id string) (*models.User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, nil
}

func (m *mockRepo) UpdateUserTheme(ctx context.Context, userID, theme string) error { return nil }
func (m *mockRepo) CreateFolder(ctx context.Context, folder *models.Folder) error { return nil }
func (m *mockRepo) GetFoldersByUserID(ctx context.Context, userID string) ([]*models.Folder, error) { return nil, nil }
func (m *mockRepo) UpdateFolder(ctx context.Context, folder *models.Folder) error { return nil }
func (m *mockRepo) DeleteFolder(ctx context.Context, id string) error { return nil }
func (m *mockRepo) AddAlbum(ctx context.Context, album *models.Album) error { return nil }
func (m *mockRepo) GetAlbumsByFolderID(ctx context.Context, folderID string) ([]*models.Album, error) { return nil, nil }
func (m *mockRepo) RemoveAlbum(ctx context.Context, albumID string) error { return nil }
func (m *mockRepo) UpdateAlbumPosition(ctx context.Context, albumID string, folderID string, position int) error { return nil }

func TestUserService(t *testing.T) {
	repo := &mockRepo{users: make(map[string]*models.User)}
	svc := NewUserService(repo)
	ctx := context.Background()

	// Signup
	user, err := svc.Signup(ctx, "test@example.com", "password123")
	assert.NoError(t, err)
	assert.NotNil(t, user)
	assert.Equal(t, "test@example.com", user.Email)

	// Login
	loggedIn, err := svc.Login(ctx, "test@example.com", "password123")
	assert.NoError(t, err)
	assert.NotNil(t, loggedIn)
	assert.Equal(t, user.ID, loggedIn.ID)

	// Login wrong password
	wrongPass, err := svc.Login(ctx, "test@example.com", "wrong")
	assert.NoError(t, err)
	assert.Nil(t, wrongPass)
}
