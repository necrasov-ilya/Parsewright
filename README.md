# Parsewright

Parsewright turns a website request into live data and a reusable extraction artifact.

The repo is shaped around a portable core first, then product surfaces around it. The manifest and runner are the contract. CLI, MCP, and the Wails desktop studio call the same extraction use case instead of owning separate logic.

## Current shape

- `packages/manifest` defines the parser artifact schema, including the `strategy` field that records the extraction shape.
- `packages/planner` provides the `ExtractionStrategy` type and a heuristic fallback for smoke tests.
- `packages/runner` executes a manifest against captured HTML.
- `packages/validator` performs page sanity and stage-one field validation.
- `packages/capture` captures pages with Playwright.
- `packages/page-reducer` turns noisy HTML into compact, neutral model context.
- `packages/model-gateway` talks to OpenAI-compatible models: plans strategy, generates manifests, classifies candidates, verifies and composes answers. Includes a heuristic smoke-test gateway.
- `packages/core` contains the `extractUniversal` use case that branches by strategy.
- `packages/normalizer` turns collection rows into comparable candidates (used only for collection with ranking).
- `packages/ranker` filters and sorts candidates by relevance and price (used only for collection with ranking).
- `packages/classifier` annotates ranked candidates, with an LLM classification seam.
- `packages/composer` provides a deterministic fallback composer for heuristic mode.
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
