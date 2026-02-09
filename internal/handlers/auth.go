package handlers

import (
	"net/http"
	"os"
	"github.com/gorilla/sessions"
)

var sessionSecret = os.Getenv("SESSION_SECRET")
var store *sessions.CookieStore

func init() {
	if sessionSecret == "" {
		sessionSecret = "default-secret-change-me-in-prod"
	}
	store = sessions.NewCookieStore([]byte(sessionSecret))
}

type AuthHandler struct{}

func NewAuthHandler() *AuthHandler {
	return &AuthHandler{}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	password := r.FormValue("password")
	appPassword := os.Getenv("APP_PASSWORD")

	if appPassword == "" {
		http.Error(w, "Application password not configured", http.StatusInternalServerError)
		return
	}

	if password != appPassword {
		http.Error(w, "Invalid password", http.StatusUnauthorized)
		return
	}

	session, _ := store.Get(r, "session")
	session.Values["authenticated"] = true
	session.Save(r, w)

	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	session, _ := store.Get(r, "session")
	session.Options.MaxAge = -1
	session.Save(r, w)
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func GetUserID(r *http.Request) string {
	return "dev"
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, _ := store.Get(r, "session")
		authenticated, ok := session.Values["authenticated"].(bool)
		if !ok || !authenticated {
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		next.ServeHTTP(w, r)
	})
}
