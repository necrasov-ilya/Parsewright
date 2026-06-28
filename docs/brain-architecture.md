# Parsewright brain architecture

The brain is the reusable extraction system behind every surface: CLI, MCP, sidecar, and the future Studio UI. The UI should not own scraping logic, provider URLs, prompt templates, or validation policy. It should collect user intent and display results.

The pipeline is:

```text
url + goal
-> Playwright capture
-> neutral page reducer
-> LLM plan strategy (fields / collection / summary)
-> LLM generate manifest (follows strategy)
-> manifest runner
-> validation + optional repair
-> branch by strategy:
   fields    -> return data as-is
   collection -> normalize -> rank -> classify (when ranking)
   summary   -> return data as-is
-> LLM verify and compose answer
-> answer + data + table + artifact
```

The LLM is involved in three decisions that deterministic code cannot make well:

1. **Strategy planning** — after capture and page reduction, the LLM reads the user goal and page context, then decides the extraction shape: `fields` (specific values from one page), `collection` (find, compare, or rank multiple items), or `summary` (digest of page content). This replaces regex-based intent detection and prevents the system from forcing every request into a listing-search shape.

2. **Manifest generation** — the LLM generates CSS selectors following the chosen strategy. The prompt no longer tells the LLM to search for collections based on keywords. The strategy tells it what to build.

3. **Verification and composition** — after extraction, the LLM checks whether the data actually answers the user goal and composes a natural-language answer in the appropriate form. For fields: state each value. For collection with ranking: name the best item and total count. For summary: write a short digest. This replaces the hardcoded "best variant" composer and adds semantic validation that structural validators cannot provide.

Provider presets live in `@parsewright/model-gateway`. This package owns provider ids, default base URLs, default models, and environment variable names. The sidecar exposes `/providers` so the UI can render choices without hardcoding provider endpoints.

The current provider model is:

```text
openai
fireworks
openai-compatible
```

The first two are presets. `openai-compatible` is the escape hatch for Ollama, LM Studio, local gateways, custom proxy servers, and enterprise endpoints.

The model is used only to design or repair an extraction artifact and to verify/compose the answer. It is not the runtime. Repeatable extraction is handled by deterministic code:

```text
manifest + html -> runner -> data
```

The page reducer strips noisy HTML and builds a compact context with reduced HTML, visible text, structured data, and neutral repeated-group signals. Prompts receive this context instead of raw full-page HTML. The reducer does not bias the context toward listings or e-commerce — it reports structural facts about the page and lets the LLM decide what matters.

The manifest supports two extraction shapes. `fields` are for single page-level values such as a title, total price, availability label, or selected product fact. `collections` are for repeated entities such as offers, products, rows, search results, reviews, cards, and table lines. Collection field selectors are relative to each repeated item, with `:scope` reserved for extracting text or attributes from the item itself.

The manifest carries an optional `strategy` field that records which extraction shape was chosen and whether ranking is needed. This lets the runner, validator, and UI adapt their behavior without guessing the intent from the data.

Validation is part of the brain, not a UI concern. Page sanity catches blocked/captcha/empty pages. Field validation catches required, type, non-empty, and max-length errors. Repair is a single model call that receives the old manifest, validation issues, extracted data, and current page context, then returns a replacement manifest. The repaired manifest must pass the same runner and validator before it is accepted. Semantic validation (does the data answer the goal?) is performed by the LLM in the verify-and-compose step.

Page sanity must avoid false positives. A normal site can mention CAPTCHA in a cookie policy, help text, or hidden template while still returning useful content. The validator should treat challenge screens as a combination of status, body size, visible challenge language, and missing useful content, not as a raw substring match.

Brain v1 returns an answer-first result. The sidecar `/extract` endpoint accepts URL, goal, OpenAI-compatible model settings, max items, and auto mode. It returns the composed answer, extracted data, optional table (for collections), strategy, verification, manifest, validation, and diagnostics. The artifact records the strategy, normalization, ranking, and pagination plans so the run can later become a saved parser project or MCP tool.

Ranking is deterministic before it is semantic. The normalizer turns collection rows into candidates with title, URL, price, currency, seller, duration, full text, and a dedupe key. The ranker filters by query relevance and sorts best-offer tasks by price while keeping score reasons. The classifier annotates the ranked shortlist and leaves the LLM classification seam ready for ambiguous cases without sending thousands of rows to a model. Ranking and classification run only when the strategy is `collection` with a ranking objective.

The UI should no longer expose heuristic mode as a user-facing concept. Studio keeps the primary surface as URL plus natural-language task, with model settings tucked into a compact control. Results render by strategy kind: a key-value table for fields, a dynamic-column table for collections, or a text block for summaries. Diagnostics are available only when needed.
