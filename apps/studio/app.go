package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

type App struct {
	ctx context.Context
	cmd *exec.Cmd
}

type ExtractRequest struct {
	URL       string `json:"url"`
	Goal      string `json:"goal"`
	Heuristic bool   `json:"heuristic"`
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	_ = a.startSidecar()
}

func (a *App) shutdown(ctx context.Context) {
	if a.cmd != nil && a.cmd.Process != nil {
		_ = a.cmd.Process.Kill()
	}
}

func (a *App) Extract(request ExtractRequest) (map[string]interface{}, error) {
	if request.URL == "" || request.Goal == "" {
		return nil, errors.New("url and goal are required")
	}
	if err := a.ensureSidecar(); err != nil {
		return nil, err
	}

	payload, _ := json.Marshal(request)
	resp, err := http.Post("http://127.0.0.1:47831/extract", "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("%v", result["error"])
	}
	return result, nil
}

func (a *App) ensureSidecar() error {
	client := http.Client{Timeout: 500 * time.Millisecond}
	resp, err := client.Get("http://127.0.0.1:47831/health")
	if err == nil {
		_ = resp.Body.Close()
		return nil
	}
	return a.startSidecar()
}

func (a *App) startSidecar() error {
	root, err := findRepoRoot()
	if err != nil {
		return err
	}
	cmd := exec.Command("pnpm", "--filter", "@parsewright/sidecar", "dev")
	cmd.Dir = root
	cmd.Env = os.Environ()
	if os.Getenv("OPENAI_API_KEY") == "" {
		cmd.Env = append(cmd.Env, "PARSEWRIGHT_HEURISTIC_DEFAULT=1")
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	a.cmd = cmd
	time.Sleep(800 * time.Millisecond)
	return nil
}

func findRepoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "pnpm-workspace.yaml")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", errors.New("could not find repository root")
		}
		dir = parent
	}
}
