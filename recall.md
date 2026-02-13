---
description: Search saved memories using natural language
argument-hint: <query>
---

# Recall — Semantic Memory Search

## Overview

Search all saved memories in `~/.agents/brain/` using natural language. Uses neural embeddings to find semantically similar sessions — "k8s crash loop" matches "kubernetes pod restart debugging" even without shared exact words.

## Usage

```
/recall <natural language query>
```

## Implementation Instructions

### Step 1: Validate Input

The `$ARGUMENTS` variable contains the user's search query.

If `$ARGUMENTS` is empty:
- Display usage help and examples
- Return without searching

### Step 2: Run Semantic Search

Use the search module from `memory-index/`:

```javascript
const { searchMemories, formatResults } = require('/Users/benjaminkrammel/.agents/commands/memory-index/search.js');

const query = $ARGUMENTS;
const results = await searchMemories(query, { threshold: 0.3, maxResults: 5 });
```

### Step 3: Display Results

Format and display the results:

```javascript
const output = formatResults(results, query);
```

Display the formatted output to the user. The format is:

```
Searching N memories...

1. [0.89] project-name/memory-20260212-134206.md
   "Description of the session truncated to 100 chars..."
   Tags: tag1, tag2, tag3

2. [0.76] other-project/memory-20260209-110856.md
   "Another session description..."
   Tags: tag4, tag5

Found N relevant memories
```

### Step 4: Offer to Read Matches

After displaying results, ask the user if they'd like to read any of the matched memory files. If they choose one, read the file and display its contents.

## Error Handling

| Scenario | Response |
|----------|----------|
| Empty query | Show usage: `/recall <query>` with examples |
| No index file | Tell user: "No memory index found. Run `/save` in a session first." |
| No embeddings in index | Tell user: "No embeddings in index. Run: `cd ~/.agents/commands/memory-index && node build-index.js --embed`" |
| Model download needed | This happens automatically on first use. Inform user it may take a moment. |
| No results above threshold | "No relevant memories found for: [query]" |

## Examples

```
/recall kubernetes network issues
/recall "how did I fix the authentication bug?"
/recall helm chart deployment problems
/recall docker container memory leak
/recall CI/CD pipeline configuration
```

## Dependencies

- `memory-index/search.js` — search logic
- `memory-index/embed.js` — embedding utility
- `@huggingface/transformers` — ML model (installed in memory-index/)
- `~/.agents/brain/memory-index.json` — index with embeddings

## Notes

- First run downloads the MiniLM-L6-v2 model (~30MB), cached in `~/.cache/huggingface/`
- Subsequent queries are fast (~200-300ms)
- Only searches memories that have embeddings. Run `node build-index.js --embed` to backfill.
- Threshold of 0.3 provides a good balance between recall and precision. Lower for more results, higher for stricter matching.
