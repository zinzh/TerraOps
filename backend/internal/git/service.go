package git

import (
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath" // Added
	"time"          // Added

	"github.com/go-git/go-git/v5" // Added
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"        // Added
	"github.com/go-git/go-git/v5/plumbing/transport/ssh" // Added for SSH Auth

	// For known_hosts handling
	gossh "golang.org/x/crypto/ssh" // Alias standard crypto/ssh
)

type Service struct {
	CloneBasePath string
	SSHKeyPath    string // Added: Path to the private SSH key
	GitUserName   string // Added: Name for commits
	GitUserEmail  string // Added: Email for commits
}

func NewService(basePath string, sshKeyPath string, userName string, userEmail string) (*Service, error) {
	if basePath == "" {
		basePath = os.TempDir() + "/terraops_clones"
	}
	err := os.MkdirAll(basePath, 0750)
	if err != nil {
		return nil, fmt.Errorf("failed to create git clone base directory '%s': %w", basePath, err)
	}

	// Basic validation for required fields
	if sshKeyPath == "" {
		log.Println("Warning: SSHKeyPath is empty in Git Service config. SSH operations will likely fail.")
	}
	if userName == "" || userEmail == "" {
		log.Println("Warning: GitUserName or GitUserEmail is empty in Git Service config. Using defaults.")
		if userName == "" {
			userName = "TerraOps Bot"
		}
		if userEmail == "" {
			userEmail = "terraops-bot@example.com"
		}
	}

	log.Printf("Git clone base directory: %s\n", basePath)
	return &Service{
		CloneBasePath: basePath,
		SSHKeyPath:    sshKeyPath,
		GitUserName:   userName,
		GitUserEmail:  userEmail,
	}, nil
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

func (s *Service) createSSHAuth() (*ssh.PublicKeys, error) {
	if s.SSHKeyPath == "" {
		return nil, fmt.Errorf("ssh key path is not configured")
	}

	var publicKey *ssh.PublicKeys
	sshKey, err := os.ReadFile(s.SSHKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read ssh key file %s: %w", s.SSHKeyPath, err)
	}

	publicKey, err = ssh.NewPublicKeys("git", sshKey, "") // Assumes no passphrase
	if err != nil {
		return nil, fmt.Errorf("failed to create public keys from ssh key: %w", err)
	}

	// --- Known Hosts Handling (Development/Insecure) ---
	// This automatically accepts the server's host key.
	// WARNING: Vulnerable to Man-in-the-Middle attacks.
	// Production systems should use a proper known_hosts file or callback.
	publicKey.HostKeyCallbackHelper = ssh.HostKeyCallbackHelper{
		HostKeyCallback: func(hostname string, remote net.Addr, key gossh.PublicKey) error {
			// For development ONLY - accept any key
			log.Printf("Warning: Automatically accepting host key for %s (%s). This is insecure!", hostname, remote)
			// To make it slightly more secure for dev, you could try and parse ~/.ssh/known_hosts
			// knownHostsPath := filepath.Join(os.Getenv("HOME"), ".ssh", "known_hosts")
			// hostKeyCallback, err := knownhosts.New(knownHostsPath)
			// if err == nil {
			//     return hostKeyCallback(hostname, remote, key)
			// }
			// log.Printf("Warning: Could not load known_hosts (%v), accepting any key.", err)
			return nil // Accept any host key
		},
		// HostKeyCallback: gossh.InsecureIgnoreHostKey(), // Older/Alternative way
	}
	// --- End Known Hosts Handling ---

	return publicKey, nil
}

func (s *Service) CloneOrOpenRepository(repoURL, branchName, destinationDirName string) (*git.Repository, string, error) {
	repoPath := filepath.Join(s.CloneBasePath, destinationDirName)

	auth, err := s.createSSHAuth()
	if err != nil {
		return nil, "", fmt.Errorf("failed to create ssh auth: %w", err)
	}

	// Try opening existing repo first
	repo, err := git.PlainOpen(repoPath)
	if err == nil {
		log.Printf("Opened existing repository at '%s'", repoPath)
		// Optional: Fetch updates and checkout branch? For simplicity, let's just checkout.
		w, err := repo.Worktree()
		if err != nil {
			return nil, repoPath, fmt.Errorf("failed to get worktree for existing repo %s: %w", repoPath, err)
		}
		checkoutOpts := &git.CheckoutOptions{
			Branch: plumbing.NewBranchReferenceName(branchName),
			Force:  false, // Don't force if there are local changes (shouldn't be if we manage it)
			Create: false, // Don't create if it doesn't exist remotely (clone should handle)
		}
		log.Printf("Checking out branch '%s' in existing repo '%s'", branchName, repoPath)
		err = w.Checkout(checkoutOpts)
		// Ignore "already up-to-date" type errors, handle others
		if err != nil {
			// Log any checkout error, but it might not be fatal for our flow yet.
			log.Printf("Warning: Error during checkout of branch %s in existing repo: %v. Proceeding...", branchName, err)
			// If specific errors MUST be fatal, add checks here.
		}
		// Optional: Pull latest changes - adds complexity with merge conflicts
		/*
		   log.Printf("Pulling latest changes for branch '%s' in existing repo '%s'", branchName, repoPath)
		   pullOpts := &git.PullOptions{
		       RemoteName:    "origin",
		       ReferenceName: plumbing.NewBranchReferenceName(branchName),
		       Auth:          auth,
		       Force:         false, // Don't force pull
		       Progress:      nil, // os.Stdout,
		   }
		   err = w.Pull(pullOpts)
		   if err != nil && err != git.NoErrAlreadyUpToDate {
		        log.Printf("Warning: Failed to pull changes for repo %s: %v", repoPath, err)
		       // Handle potential merge conflicts or other pull errors? For now, log and continue.
		   }
		*/

		return repo, repoPath, nil // Return existing repo
	}

	// If opening failed (likely ErrRepositoryNotExists), clone it
	if err != git.ErrRepositoryNotExists {
		return nil, repoPath, fmt.Errorf("failed to open repository at %s: %w", repoPath, err)
	}

	// Clone the repository
	log.Printf("Cloning repository '%s' (branch: %s) to '%s'\n", repoURL, branchName, repoPath)
	err = os.RemoveAll(repoPath) // Clean up before clone attempt
	if err != nil {
		log.Printf("Warning: failed to remove existing directory '%s' before clone: %v\n", repoPath, err)
	}

	repo, err = git.PlainClone(repoPath, false, &git.CloneOptions{
		URL:           repoURL,
		Auth:          auth,
		ReferenceName: plumbing.NewBranchReferenceName(branchName),
		SingleBranch:  true,
		Depth:         1,   // Shallow clone is usually sufficient
		Progress:      nil, // os.Stdout,
		// NoCheckout: true, // Alternative: Clone without checkout, then checkout manually
	})

	if err != nil {
		log.Printf("Error cloning repository %s: %v\n", repoURL, err)
		_ = os.RemoveAll(repoPath) // Attempt cleanup on error
		return nil, "", fmt.Errorf("failed to clone repository %s: %w", repoURL, err)
	}

	// If clone worked but branch wasn't checked out (e.g., with NoCheckout)
	/* w, err := repo.Worktree()
	   if err != nil { return nil, "", err }
	   err = w.Checkout(&git.CheckoutOptions{Branch: plumbing.NewBranchReferenceName(branchName)})
	   if err != nil { return nil, "", err }
	*/

	log.Printf("Successfully cloned repository '%s' to '%s'\n", repoURL, repoPath)
	return repo, repoPath, nil
}

func (s *Service) CommitAndPush(repo *git.Repository, repoPath string, branchName string, commitMessage string) error {
	w, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("failed to get worktree for repo %s: %w", repoPath, err)
	}

	// Check status - optional but good practice
	status, err := w.Status()
	if err != nil {
		return fmt.Errorf("failed to get git status for repo %s: %w", repoPath, err)
	}
	log.Printf("Git status for %s:\n%s", repoPath, status)
	if status.IsClean() {
		log.Printf("No changes detected in %s. Nothing to commit or push.", repoPath)
		return nil // No changes, successful no-op
	}

	// Add all changes (equivalent to git add .)
	// For more control, add specific files: w.Add("main.tf"), w.Add("terraform.tfvars")
	log.Printf("Adding all changes in %s", repoPath)
	err = w.AddWithOptions(&git.AddOptions{All: true})
	if err != nil {
		return fmt.Errorf("failed to git add changes in %s: %w", repoPath, err)
	}

	// Commit changes
	if commitMessage == "" {
		commitMessage = "Update configuration via TerraOps" // Default message
	}
	log.Printf("Committing changes in %s with message: %s", repoPath, commitMessage)
	commitOpts := &git.CommitOptions{
		Author: &object.Signature{
			Name:  s.GitUserName,
			Email: s.GitUserEmail,
			When:  time.Now(),
		},
		// Committer is same as Author unless specified otherwise
	}
	_, err = w.Commit(commitMessage, commitOpts)
	if err != nil {
		return fmt.Errorf("failed to git commit in %s: %w", repoPath, err)
	}

	// Push changes
	log.Printf("Pushing changes to origin branch '%s' for repo %s", branchName, repoPath)
	auth, err := s.createSSHAuth()
	if err != nil {
		return fmt.Errorf("failed to create ssh auth for push: %w", err)
	}

	pushOpts := &git.PushOptions{
		RemoteName: "origin", // Default remote name
		// RefSpecs can be more specific if needed
		// RefSpecs: []config.RefSpec{config.RefSpec(fmt.Sprintf("refs/heads/%s:refs/heads/%s", branchName, branchName))},
		Auth:     auth,
		Progress: nil, // os.Stdout,
	}
	err = repo.Push(pushOpts)
	if err != nil {
		// Handle specific non-fatal errors if needed (e.g., up-to-date)
		if err == git.NoErrAlreadyUpToDate {
			log.Printf("Push successful: remote branch %s already up-to-date for %s", branchName, repoPath)
			return nil
		}
		return fmt.Errorf("failed to git push to branch %s for %s: %w", branchName, repoPath, err)
	}

	log.Printf("Successfully pushed changes to origin branch '%s' for repo %s", branchName, repoPath)
	return nil
}
