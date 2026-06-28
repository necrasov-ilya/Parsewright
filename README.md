# Parsewright

Parsewright turns a website request into live data and a reusable extraction artifact.

The repo is shaped around a portable core first, then product surfaces around it. The manifest and runner are the contract. CLI, MCP, and the Wails desktop studio call the same extraction use case instead of owning separate logic.

## Current shape

- `packages/manifest` defines the parser artifact schema.
- `packages/runner` executes a manifest against captured HTML.
- `packages/validator` performs page sanity and stage-one field validation.
- `packages/capture` captures pages with Playwright.
- `packages/page-reducer` turns noisy HTML into compact model context.
- `packages/model-gateway` talks to OpenAI-compatible models, with a heuristic smoke-test gateway.
- `packages/core` contains the `extractOnce` use case.
- `packages/storage` saves manifests, results, and snapshots to project folders.
- `apps/cli` exposes the core from the terminal.
- `apps/mcp` exposes a minimal `extract_once` MCP tool.
- `apps/sidecar` exposes a localhost API for the desktop app.
- `apps/studio` is a Wails v2 + React shell that manages the sidecar.

## Development

```bash
pnpm install
pnpm typecheck
pnpm build
```

Smoke test without an API key:

```bash
pnpm --filter @parsewright/cli exec tsx src/index.ts extract --url "https://example.com" --goal "title" --heuristic
```

Run the sidecar:

```bash
pnpm sidecar
```

Build the Wails studio:

```bash
cd apps/studio
wails build
```

Use `OPENAI_API_KEY` for OpenAI, `FIREWORKS_API_KEY` for Fireworks, or `PARSEWRIGHT_PROVIDER`, `PARSEWRIGHT_BASE_URL`, and `PARSEWRIGHT_MODEL` to override model routing. The heuristic mode is only for smoke tests.
