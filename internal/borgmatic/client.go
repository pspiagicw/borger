package borgmatic

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

type Archive struct {
	Name  string `json:"name"`
	Start string `json:"start"`
	Time  string `json:"time"`
}

type Repository struct {
	Location string `json:"location"`
	Label    string `json:"label"`
}

type ListEntry struct {
	Archives   []Archive  `json:"archives"`
	Repository Repository `json:"repository"`
}

type Client struct {
	binary  string
	timeout time.Duration
}

func NewClient(binary string, timeout time.Duration) *Client {
	return &Client{binary: binary, timeout: timeout}
}

func (c *Client) List(ctx context.Context) ([]ListEntry, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	cmd := exec.CommandContext(timeoutCtx, c.binary, "list", "--json")
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return nil, fmt.Errorf("run borgmatic list --json: %w: %s", err, strings.TrimSpace(stderr.String()))
	}

	var entries []ListEntry
	if err := json.Unmarshal(stdout.Bytes(), &entries); err != nil {
		return nil, fmt.Errorf("parse borgmatic json: %w", err)
	}

	return entries, nil
}
