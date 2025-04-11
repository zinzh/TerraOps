package git

import (
	"fmt"
	"log"
	"os"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	// Add imports for authentication later if needed (e.g., plumbing/transport/ssh)
)

type Service struct {
	CloneBasePath string // Base path for temporary clones
}

func NewService(basePath string) (*Service, error) {
	if basePath == "" {
		// Default to a subdirectory within the system's temp dir
		basePath = os.TempDir() + "/terraops_clones"
	}
	// Ensure the base directory exists
	err := os.MkdirAll(basePath, 0750)
	if err != nil {
		return nil, fmt.Errorf("failed to create git clone base directory '%s': %w", basePath, err)
	}
	log.Printf("Git clone base directory: %s\n", basePath)
	return &Service{CloneBasePath: basePath}, nil
}

// CloneRepository clones a public Git repository to a temporary location.
// Returns the path to the cloned repository or an error.
// TODO: Add authentication support for private repositories.
// TODO: Add specific branch/tag support.
func (s *Service) CloneRepository(repoURL string, destinationDirName string) (string, error) {
	repoPath := fmt.Sprintf("%s/%s", s.CloneBasePath, destinationDirName)

	// Clean up any existing directory first (important for retries/updates)
	log.Printf("Removing existing clone directory if present: %s\n", repoPath)
	err := os.RemoveAll(repoPath)
	if err != nil {
		log.Printf("Warning: failed to remove existing clone directory '%s': %v\n", repoPath, err)
		// Continue, as git clone might handle it, but log the warning.
	}

	log.Printf("Cloning repository '%s' to '%s'\n", repoURL, repoPath)

	_, err = git.PlainClone(repoPath, false, &git.CloneOptions{
		URL:      repoURL,
		Progress: nil, // Can add os.Stdout here for verbose logging
		// Depth: 1, // Optional: Use shallow clone for speed if history isn't needed
		ReferenceName: plumbing.HEAD, // Clone default branch (usually main/master)
		SingleBranch:  true,          // Optimize for cloning only the default branch
		// Auth: Add authentication method here later (e.g., ssh.PublicKeys)
	})

	if err != nil {
		log.Printf("Error cloning repository %s: %v\n", repoURL, err)
		// Attempt cleanup on error
		_ = os.RemoveAll(repoPath)
		return "", fmt.Errorf("failed to clone repository %s: %w", repoURL, err)
	}

	log.Printf("Successfully cloned repository '%s' to '%s'\n", repoURL, repoPath)
	return repoPath, nil
}

// CleanupRepository removes the cloned repository directory.
func (s *Service) CleanupRepository(destinationDirName string) error {
	repoPath := fmt.Sprintf("%s/%s", s.CloneBasePath, destinationDirName)
	log.Printf("Cleaning up cloned repository at %s\n", repoPath)
	err := os.RemoveAll(repoPath)
	if err != nil {
		log.Printf("Error removing directory %s: %v\n", repoPath, err)
		return fmt.Errorf("failed to clean up repository directory %s: %w", repoPath, err)
	}
	return nil
}
