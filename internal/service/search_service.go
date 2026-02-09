package service

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

type SearchResult struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Artist      string `json:"artist"`
	ImageUrl    string `json:"imageUrl"`
	ExternalUrl string `json:"externalUrl"`
}

type SearchService struct {
	client       *http.Client
	spotifyID     string
	spotifySecret string
	spotifyToken  string
}

func NewSearchService(spotifyID, spotifySecret string) *SearchService {
	return &SearchService{
		client:        &http.Client{},
		spotifyID:     spotifyID,
		spotifySecret: spotifySecret,
	}
}

func (s *SearchService) SearchApple(query string) ([]SearchResult, error) {
	resp, err := s.client.Get(fmt.Sprintf("https://itunes.apple.com/search?term=%s&entity=album&limit=25", url.QueryEscape(query)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Results []struct {
			CollectionId   int    `json:"collectionId"`
			CollectionName string `json:"collectionName"`
			ArtistName     string `json:"artistName"`
			ArtworkUrl100  string `json:"artworkUrl100"`
			CollectionViewUrl string `json:"collectionViewUrl"`
		} `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(data.Results))
	for _, r := range data.Results {
		results = append(results, SearchResult{
			ID:          fmt.Sprintf("apple-%d", r.CollectionId),
			Name:        r.CollectionName,
			Artist:      r.ArtistName,
			ImageUrl:    r.ArtworkUrl100,
			ExternalUrl: r.CollectionViewUrl,
		})
	}
	return results, nil
}

func (s *SearchService) SearchSpotify(query string) ([]SearchResult, error) {
	if s.spotifyID == "" || s.spotifySecret == "" {
		return nil, fmt.Errorf("spotify credentials not configured")
	}

	if s.spotifyToken == "" {
		if err := s.refreshSpotifyToken(); err != nil {
			return nil, err
		}
	}

	req, _ := http.NewRequest("GET", fmt.Sprintf("https://api.spotify.com/v1/search?q=%s&type=album&limit=25", url.QueryEscape(query)), nil)
	req.Header.Set("Authorization", "Bearer "+s.spotifyToken)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		if err := s.refreshSpotifyToken(); err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+s.spotifyToken)
		resp, err = s.client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
	}

	var data struct {
		Albums struct {
			Items []struct {
				ID      string `json:"id"`
				Name    string `json:"name"`
				Artists []struct {
					Name string `json:"name"`
				} `json:"artists"`
				Images []struct {
					URL string `json:"url"`
				} `json:"images"`
				ExternalUrls struct {
					Spotify string `json:"spotify"`
				} `json:"external_urls"`
			} `json:"items"`
		} `json:"albums"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(data.Albums.Items))
	for _, r := range data.Albums.Items {
		artist := ""
		if len(r.Artists) > 0 {
			artist = r.Artists[0].Name
		}
		imageUrl := ""
		if len(r.Images) > 0 {
			imageUrl = r.Images[0].URL
		}
		results = append(results, SearchResult{
			ID:          "spotify-" + r.ID,
			Name:        r.Name,
			Artist:      artist,
			ImageUrl:    imageUrl,
			ExternalUrl: r.ExternalUrls.Spotify,
		})
	}
	return results, nil
}

func (s *SearchService) refreshSpotifyToken() error {
	data := url.Values{}
	data.Set("grant_type", "client_credentials")

	req, _ := http.NewRequest("POST", "https://accounts.spotify.com/api/token", strings.NewReader(data.Encode()))
	req.SetBasicAuth(s.spotifyID, s.spotifySecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var res struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return err
	}

	s.spotifyToken = res.AccessToken
	return nil
}

func (s *SearchService) SearchDeezer(query string) ([]SearchResult, error) {
	resp, err := s.client.Get(fmt.Sprintf("https://api.deezer.com/search/album?q=%s&limit=25", url.QueryEscape(query)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Data []struct {
			ID    int    `json:"id"`
			Title string `json:"title"`
			Artist struct {
				Name string `json:"name"`
			} `json:"artist"`
			CoverMedium string `json:"cover_medium"`
			Link        string `json:"link"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(data.Data))
	for _, r := range data.Data {
		results = append(results, SearchResult{
			ID:          fmt.Sprintf("deezer-%d", r.ID),
			Name:        r.Title,
			Artist:      r.Artist.Name,
			ImageUrl:    r.CoverMedium,
			ExternalUrl: r.Link,
		})
	}
	return results, nil
}
