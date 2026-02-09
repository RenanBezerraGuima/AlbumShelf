package service

import (
	"testing"
	"github.com/stretchr/testify/assert"
)

func TestSearchApple(t *testing.T) {
	// This hits the real API, might want to mock it for real TDD
	// but for now let's just see if it works.
	svc := NewSearchService("", "")
	results, err := svc.SearchApple("Daft Punk")
	assert.NoError(t, err)
	assert.NotEmpty(t, results)
	assert.Equal(t, "Daft Punk", results[0].Artist)
}
