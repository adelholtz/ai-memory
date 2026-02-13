# Semantic Memory Recall — Design Document

**Date**: 2026-02-13
**Status**: Approved
**Scope**: New `/recall` command + embedding integration into `/save`

## Problem

The current memory-index uses exact keyword and tag matching to find related sessions. This misses semantically related content — "kubernetes troubleshooting" won't match "k8s pod restart debugging" despite being about the same thing. Users want natural language search over all saved memories.

## Solution

Add neural embeddings (via `@huggingface/transformers` running locally) to the memory-index system. A new `/recall` slash command enables natural language search over all saved memories using cosine similarity on sentence embeddings.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embedding model | Xenova/all-MiniLM-L6-v2 | 384-dim, ~30MB, fast (~170ms), good quality for technical text |
| Embedding source | transformers.js (local WASM) | No API key, runs offline, zero cost |
| Storage | Extend memory-index.json | Fits current scale (10-100 files), no new database dependency |
| Architecture | Embed-on-Save | Self-maintaining, fast recall, ~200ms overhead on save |
| Interface | New `/recall` slash command | Clean separation from `/save`, dedicated search UX |

## Architecture

```
/save (enhanced)                    /recall (new)
──────────────                      ─────────────
1. Existing save steps              1. Receive query string
2. Generate embedding for desc      2. Load model (cached)
3. Store embedding in index         3. Embed query → 384-dim vector
4. Update index (existing)          4. Load memory-index.json
                                    5. Cosine similarity vs all embeddings
                                    6. Rank, return top 5 (threshold 0.5)
```

## Index Schema Change

New `embedding` field per entry in `memory-index.json`:

```json
{
  "/path/to/file.md": {
    "tags": ["kubernetes", "debugging"],
    "descriptionKeywords": ["diagnosed", "kubernetes"],
    "mtime": 1770900175,
    "basename": "config-service",
    "filename": "memory-20260212-134206.md",
    "embedding": [0.023, -0.156, 0.089, "...384 floats"]
  }
}
```

Size impact: ~3KB per entry. At 100 files: ~300KB total. At 1000 files: ~3MB.

Backward compatibility: entries without `embedding` are skipped during search.

## New Files

| File | Purpose |
|------|---------|
| `recall.md` | `/recall` slash command definition |
| `memory-index/embed.js` | Embedding utility: model loading, embed(), cosineSimilarity() |
| `memory-index/search.js` | Search logic: load index, rank results, format output |

## Modified Files

| File | Change |
|------|--------|
| `save.md` | Add Step 10b: generate embedding after saving |
| `memory-index/update-index.js` | Accept optional embedding param, store in entry |
| `memory-index/build-index.js` | Add `--embed` flag for backfilling embeddings |
| `memory-index/package.json` | Add `@huggingface/transformers` dependency |

## `/recall` Command UX

```
Usage:
  /recall <natural language query>

Examples:
  /recall kubernetes network debugging
  /recall "when did I work on authentication?"
  /recall helm chart configuration issues

Output:
  Searching 10 memories...

  1. [0.89] config-service/memory-20260212-134206.md
     "Diagnosed and fixed a Kubernetes deployment caching issue..."
     Tags: kubernetes, helm, docker, ci-cd

  2. [0.76] commands/memory-20260209-110856.md
     "Performed systematic Kubernetes diagnostics..."
     Tags: kubernetes, diagnostics, debugging

  Found 2 relevant memories (threshold: 0.5)
```

## `embed.js` API

```javascript
async function loadModel()           // Load/cache MiniLM-L6-v2
async function embed(text)           // Text → Float32Array(384)
function cosineSimilarity(a, b)      // Two vectors → score 0-1
```

Model cached in `~/.cache/huggingface/` by transformers.js automatically.

## Error Handling

| Scenario | Handling |
|----------|----------|
| Model not yet downloaded | Auto-download on first use, show progress |
| No embeddings in index | Show message: "Run `/save` to build embeddings, or `node build-index.js --embed`" |
| Embedding generation fails | `/save` continues without embedding (graceful degradation) |
| All scores below threshold | "No relevant memories found for query" |
| Empty query | Show usage help |

## Performance Budget

| Operation | Target |
|-----------|--------|
| Model load (cold) | < 2s (first query in session) |
| Model load (cached) | < 500ms |
| Embed single query | < 200ms |
| Cosine similarity (100 entries) | < 5ms |
| Total /recall latency (warm) | < 300ms |
| /save embedding overhead | < 250ms |
