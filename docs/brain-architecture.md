# Parsewright brain architecture

The brain is the reusable extraction system behind every surface: CLI, MCP, sidecar, and the future Studio UI. The UI should not own scraping logic, provider URLs, prompt templates, or validation policy. It should collect user intent and display results.

The pipeline is:

```text
url + goal
-> Playwright capture
-> page reducer
-> model gateway
-> manifest validation
-> manifest runner
-> data validation
-> one repair attempt when validation fails
-> result + manifest artifact
```

Provider presets live in `@parsewright/model-gateway`. This package owns provider ids, default base URLs, default models, and environment variable names. The sidecar exposes `/providers` so the UI can render choices without hardcoding provider endpoints. The UI may later store a selected provider and model, but backend code must normalize and validate the provider configuration before any model call.

The current provider model is:

```text
openai
fireworks
openai-compatible
```

The first two are presets. `openai-compatible` is the escape hatch for Ollama, LM Studio, local gateways, custom proxy servers, and enterprise endpoints.

The model is used only to design or repair an extraction artifact. It is not the runtime. Repeatable extraction is handled by deterministic code:

```text
manifest + html -> runner -> data
```

The page reducer strips noisy HTML and builds a compact context with reduced HTML, visible text, structured data, and ranked candidate elements. Prompts receive this context instead of raw full-page HTML when possible.

The first artifact target is a declarative manifest. Generated TypeScript fallback is intentionally deferred until the manifest path is proven. The manifest is safer, easier to validate, easier to run from CLI/MCP, and easier to share in a future parser registry.

Validation is part of the brain, not a UI concern. Page sanity catches blocked/captcha/empty pages. Field validation catches required, type, non-empty, and max-length errors. Repair v0 is a single model call that receives the old manifest, validation issues, extracted data, and current page context, then returns a replacement manifest. The repaired manifest must pass the same runner and validator before it is accepted.
