package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
	cmd *exec.Cmd
}

type ExtractRequest struct {
	URL      string `json:"url"`
	Goal     string `json:"goal"`
	DialogID int    `json:"dialogId,omitempty"`
	Provider string `json:"provider"`
	BaseURL  string `json:"baseUrl"`
	Model    string `json:"model"`
	APIKey   string `json:"apiKey"`
	MaxItems int    `json:"maxItems"`
	Mode     string `json:"mode"`
}

type CodeGenRequest struct {
	Manifest          map[string]interface{} `json:"manifest"`
	Language          string                 `json:"language"`
	IncludeDocs       bool                   `json:"includeDocs"`
	ExtraRequirements string                 `json:"extraRequirements"`
	Provider          string                 `json:"provider"`
	BaseURL           string                 `json:"baseUrl"`
	Model             string                 `json:"model"`
	APIKey            string                 `json:"apiKey"`
	Heuristic         bool                   `json:"heuristic"`
}

type HealthResponse struct {
	OK            bool   `json:"ok"`
	Version       string `json:"version"`
	PID           int    `json:"pid"`
	WorkspaceRoot string `json:"workspaceRoot"`
}

type ResetResponse struct {
	OK bool `json:"ok"`
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	_ = a.startSidecar()
}

func (a *App) shutdown(ctx context.Context) {
	a.killSidecar()
}

func (a *App) killSidecar() {
	if a.cmd != nil && a.cmd.Process != nil {
		_ = a.cmd.Process.Kill()
		_ = a.cmd.Wait()
		a.cmd = nil
	}
	client := http.Client{Timeout: 500 * time.Millisecond}
	if resp, err := client.Get("http://127.0.0.1:47831/health"); err == nil {
		defer resp.Body.Close()
		var health HealthResponse
		if json.NewDecoder(resp.Body).Decode(&health) == nil && health.PID > 0 {
			if process, findErr := os.FindProcess(health.PID); findErr == nil {
				_ = process.Kill()
			}
		}
	}
	time.Sleep(500 * time.Millisecond)
}

func (a *App) Reset() (ResetResponse, error) {
	client := http.Client{Timeout: 2 * time.Second}
	_, _ = client.Post("http://127.0.0.1:47831/reset", "application/json", bytes.NewReader([]byte("{}")))
	a.killSidecar()
	if err := a.startSidecar(); err != nil {
		return ResetResponse{}, err
	}
	return ResetResponse{OK: true}, nil
}

func (a *App) Extract(request ExtractRequest) (map[string]interface{}, error) {
	if request.URL == "" || request.Goal == "" {
		return nil, errors.New("url and goal are required")
	}
	if err := a.ensureSidecar(); err != nil {
		return nil, err
	}

	payload, _ := json.Marshal(request)
	resp, err := http.Post("http://127.0.0.1:47831/extract/stream", "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024)
	var finalResult map[string]interface{}

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := line[6:]
		var event map[string]interface{}
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}

		stage, _ := event["stage"].(string)
		status, _ := event["status"].(string)

		if stage == "done" && status == "done" {
			if data, ok := event["data"].(map[string]interface{}); ok {
				finalResult = data
			}
			wailsRuntime.EventsEmit(a.ctx, "extract:event", event)
			break
		}

		if stage == "error" || status == "error" {
			wailsRuntime.EventsEmit(a.ctx, "extract:event", event)
			errMsg := "extraction failed"
			if data, ok := event["data"].(map[string]interface{}); ok {
				if e, ok := data["error"].(string); ok {
					errMsg = e
				}
			}
			return nil, errors.New(errMsg)
		}

		wailsRuntime.EventsEmit(a.ctx, "extract:event", event)
	}

	if finalResult == nil {
		return nil, errors.New("stream ended without result")
	}
	return finalResult, nil
}

func (a *App) GenerateCode(request CodeGenRequest) (map[string]interface{}, error) {
	if err := a.ensureSidecar(); err != nil {
		return nil, err
	}

	payload, _ := json.Marshal(request)
	resp, err := http.Post("http://127.0.0.1:47831/codegen/stream", "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 512*1024), 512*1024)
	var code string
	var usage map[string]interface{}

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := line[6:]
		var event map[string]interface{}
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}

		eventType, _ := event["type"].(string)

		if eventType == "done" {
			if c, ok := event["code"].(string); ok {
				code = c
			}
			if u, ok := event["usage"].(map[string]interface{}); ok {
				usage = u
			}
			wailsRuntime.EventsEmit(a.ctx, "codegen:event", event)
			break
		}

		if eventType == "error" {
			wailsRuntime.EventsEmit(a.ctx, "codegen:event", event)
			errMsg := "code generation failed"
			if e, ok := event["error"].(string); ok {
				errMsg = e
			}
			return nil, errors.New(errMsg)
		}

		wailsRuntime.EventsEmit(a.ctx, "codegen:event", event)
	}

	return map[string]interface{}{
		"code":  code,
		"usage": usage,
	}, nil
}

func (a *App) ensureSidecar() error {
	root, err := findRepoRoot()
	if err != nil {
		return err
	}
	client := http.Client{Timeout: 500 * time.Millisecond}
	resp, err := client.Get("http://127.0.0.1:47831/health")
	if err == nil {
		defer resp.Body.Close()
		var health HealthResponse
		if json.NewDecoder(resp.Body).Decode(&health) == nil && health.OK && health.Version == "brain-v1" && filepath.Clean(health.WorkspaceRoot) == filepath.Clean(root) {
			return nil
		}
		if health.PID > 0 {
			if process, findErr := os.FindProcess(health.PID); findErr == nil {
				_ = process.Kill()
				time.Sleep(500 * time.Millisecond)
			}
		}
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
