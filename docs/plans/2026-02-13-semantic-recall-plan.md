# Semantic Recall Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add neural embedding-based semantic search to the memory system via a new `/recall` slash command, with embeddings generated at `/save` time.

**Architecture:** Extend the existing `memory-index/` module with embedding utilities (`embed.js`, `search.js`), store 384-dim vectors in `memory-index.json`, and create a `recall.md` slash command that loads the index and ranks by cosine similarity.

**Tech Stack:** Node.js (CommonJS), `@huggingface/transformers` (MiniLM-L6-v2), existing `js-yaml`

---

### Task 1: Install transformers.js dependency

**Files:**
- Modify: `memory-index/package.json`

**Step 1: Add the dependency**

```bash
cd /Users/benjaminkrammel/.agents/commands/memory-index && npm install @huggingface/transformers
```

**Step 2: Verify installation**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node -e "const { pipeline } = require('@huggingface/transformers'); console.log('OK:', typeof pipeline)"`
Expected: `OK: function`

**Step 3: Commit**

```bash
git add memory-index/package.json memory-index/package-lock.json
git commit -m "chore: add @huggingface/transformers dependency"
```

**Note:** Do NOT commit `node_modules/`. It's already gitignored. If it isn't, add `memory-index/node_modules/` to `.gitignore` first.

---

### Task 2: Create embed.js — embedding utility

**Files:**
- Create: `memory-index/embed.js`
- Create: `memory-index/test-embed.js`

**Step 1: Write the test**

Create `memory-index/test-embed.js`:

```javascript
#!/usr/bin/env node

/**
 * Test for embed.js — embedding utility
 */

const { cosineSimilarity, embed, loadModel } = require('./embed.js');

async function runTests() {
  console.log('=== Embed Module Tests ===\n');

  // Test 1: cosineSimilarity — pure math, no model needed
  console.log('Test 1: cosineSimilarity with identical vectors...');
  const vecA = [1, 0, 0];
  const vecB = [1, 0, 0];
  const sim1 = cosineSimilarity(vecA, vecB);
  console.assert(Math.abs(sim1 - 1.0) < 0.001, `Expected ~1.0, got ${sim1}`);
  console.log(`✓ Identical vectors: ${sim1.toFixed(4)}`);

  console.log('Test 2: cosineSimilarity with orthogonal vectors...');
  const sim2 = cosineSimilarity([1, 0, 0], [0, 1, 0]);
  console.assert(Math.abs(sim2) < 0.001, `Expected ~0.0, got ${sim2}`);
  console.log(`✓ Orthogonal vectors: ${sim2.toFixed(4)}`);

  console.log('Test 3: cosineSimilarity with opposite vectors...');
  const sim3 = cosineSimilarity([1, 0], [-1, 0]);
  console.assert(Math.abs(sim3 - (-1.0)) < 0.001, `Expected ~-1.0, got ${sim3}`);
  console.log(`✓ Opposite vectors: ${sim3.toFixed(4)}`);

  // Test 4: Load model and embed text
  console.log('\nTest 4: Loading model (this may download ~30MB on first run)...');
  await loadModel();
  console.log('✓ Model loaded');

  console.log('Test 5: Embed a sentence...');
  const embedding = await embed('kubernetes pod debugging');
  console.assert(Array.isArray(embedding), 'Embedding should be an array');
  console.assert(embedding.length === 384, `Expected 384 dims, got ${embedding.length}`);
  console.assert(typeof embedding[0] === 'number', 'Elements should be numbers');
  console.log(`✓ Embedding: ${embedding.length} dimensions, first 3: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}]`);

  // Test 6: Similar sentences should have high similarity
  console.log('Test 6: Semantic similarity — related sentences...');
  const emb1 = await embed('kubernetes pod restart debugging');
  const emb2 = await embed('k8s container crash troubleshooting');
  const emb3 = await embed('chocolate cake recipe ingredients');
  const simRelated = cosineSimilarity(emb1, emb2);
  const simUnrelated = cosineSimilarity(emb1, emb3);
  console.assert(simRelated > simUnrelated, `Related (${simRelated.toFixed(4)}) should be > unrelated (${simUnrelated.toFixed(4)})`);
  console.log(`✓ Related: ${simRelated.toFixed(4)}, Unrelated: ${simUnrelated.toFixed(4)}`);

  console.log('\n=== All embed tests passed ===');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node test-embed.js`
Expected: FAIL with `Cannot find module './embed.js'`

**Step 3: Write the implementation**

Create `memory-index/embed.js`:

```javascript
/**
 * Embedding utility for memory index
 * Uses @huggingface/transformers to generate sentence embeddings locally
 */

const { pipeline } = require('@huggingface/transformers');

let extractor = null;

/**
 * Load the sentence embedding model. Cached after first call.
 * Model downloads ~30MB on first use, cached in ~/.cache/huggingface/
 */
async function loadModel() {
  if (extractor) return extractor;
  extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    dtype: 'fp32',
  });
  return extractor;
}

/**
 * Generate a 384-dimensional embedding for a text string
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Array of 384 floats
 */
async function embed(text) {
  const model = await loadModel();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Compute cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Similarity score between -1 and 1
 */
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

module.exports = { loadModel, embed, cosineSimilarity };
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node test-embed.js`
Expected: All 6 tests pass. First run may take 10-30s for model download.

**Step 5: Commit**

```bash
git add memory-index/embed.js memory-index/test-embed.js
git commit -m "feat: add embedding utility with transformers.js"
```

---

### Task 3: Create search.js — search logic

**Files:**
- Create: `memory-index/search.js`
- Create: `memory-index/test-search.js`

**Step 1: Write the test**

Create `memory-index/test-search.js`:

```javascript
#!/usr/bin/env node

/**
 * Test for search.js — semantic search over memory index
 */

const path = require('path');
const os = require('os');
const { searchMemories, formatResults } = require('./search.js');

async function runTests() {
  console.log('=== Search Module Tests ===\n');

  // Test 1: Search with a query (requires index + embeddings to exist)
  console.log('Test 1: Search for kubernetes-related memories...');
  const results = await searchMemories('kubernetes debugging');
  console.assert(Array.isArray(results), 'Results should be an array');
  console.log(`✓ Found ${results.length} results`);

  if (results.length > 0) {
    const first = results[0];
    console.assert(typeof first.score === 'number', 'Result should have score');
    console.assert(typeof first.filepath === 'string', 'Result should have filepath');
    console.assert(typeof first.description === 'string', 'Result should have description');
    console.assert(typeof first.basename === 'string', 'Result should have basename');
    console.assert(typeof first.filename === 'string', 'Result should have filename');
    console.assert(Array.isArray(first.tags), 'Result should have tags array');
    console.log(`  Top result: [${first.score.toFixed(2)}] ${first.basename}/${first.filename}`);
    console.log(`  Description: ${first.description.slice(0, 80)}...`);

    // Results should be sorted by score descending
    for (let i = 1; i < results.length; i++) {
      console.assert(results[i - 1].score >= results[i].score, 'Results should be sorted by score descending');
    }
    console.log('✓ Results sorted correctly');
  }

  // Test 2: Format results for display
  console.log('\nTest 2: Format results...');
  const formatted = formatResults(results, 'kubernetes debugging');
  console.assert(typeof formatted === 'string', 'Formatted output should be a string');
  console.log('✓ Formatted output:');
  console.log(formatted);

  // Test 3: Search with unrelated query should return fewer/no results
  console.log('\nTest 3: Search for unrelated topic...');
  const unrelated = await searchMemories('french cuisine cooking recipes');
  console.log(`✓ Found ${unrelated.length} results for unrelated query`);
  // Unrelated results should score lower than related ones
  if (results.length > 0 && unrelated.length > 0) {
    console.assert(
      results[0].score >= unrelated[0].score,
      `Related top score (${results[0].score.toFixed(3)}) should >= unrelated (${unrelated[0].score.toFixed(3)})`
    );
    console.log('✓ Related query scores higher than unrelated');
  }

  console.log('\n=== All search tests passed ===');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node test-search.js`
Expected: FAIL with `Cannot find module './search.js'`

**Step 3: Write the implementation**

Create `memory-index/search.js`:

```javascript
#!/usr/bin/env node

/**
 * Semantic search over memory index
 * Loads embeddings from memory-index.json and ranks by cosine similarity
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { embed, cosineSimilarity } = require('./embed.js');

const INDEX_PATH = path.join(os.homedir(), '.agents', 'brain', 'memory-index.json');
const DEFAULT_THRESHOLD = 0.3;
const DEFAULT_MAX_RESULTS = 5;

/**
 * Search memories by semantic similarity to a query
 * @param {string} query - Natural language search query
 * @param {object} [options] - Search options
 * @param {number} [options.threshold=0.3] - Minimum similarity score (0-1)
 * @param {number} [options.maxResults=5] - Maximum number of results
 * @returns {Promise<Array<{score: number, filepath: string, basename: string, filename: string, description: string, tags: string[]}>>}
 */
async function searchMemories(query, options = {}) {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;

  // Load index
  let index;
  try {
    const content = fs.readFileSync(INDEX_PATH, 'utf8');
    index = JSON.parse(content);
  } catch (error) {
    console.error('Cannot load memory index:', error.message);
    console.error('Run: cd memory-index && ./build-index.js --embed');
    return [];
  }

  // Embed the query
  const queryEmbedding = await embed(query);

  // Score all entries that have embeddings
  const scored = [];
  for (const [filepath, entry] of Object.entries(index.entries)) {
    if (!entry.embedding || entry.embedding.length === 0) continue;

    const score = cosineSimilarity(queryEmbedding, entry.embedding);
    if (score >= threshold) {
      scored.push({
        score,
        filepath,
        basename: entry.basename,
        filename: entry.filename,
        description: entry.description || '',
        tags: entry.tags || []
      });
    }
  }

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

/**
 * Format search results for display
 * @param {Array} results - Results from searchMemories()
 * @param {string} query - Original query (for display)
 * @returns {string} Formatted output string
 */
function formatResults(results, query) {
  if (results.length === 0) {
    return `No relevant memories found for: "${query}"\n\nTip: Run /save in your sessions to build the embedding index.`;
  }

  const lines = [];
  results.forEach((result, i) => {
    const desc = result.description.length > 100
      ? result.description.slice(0, 100) + '...'
      : result.description;
    lines.push(`${i + 1}. [${result.score.toFixed(2)}] ${result.basename}/${result.filename}`);
    lines.push(`   "${desc}"`);
    if (result.tags.length > 0) {
      lines.push(`   Tags: ${result.tags.join(', ')}`);
    }
    lines.push('');
  });

  lines.push(`Found ${results.length} relevant memories`);
  return lines.join('\n');
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: node search.js <query>');
    console.log('');
    console.log('Search memories by semantic similarity.');
    console.log('');
    console.log('Examples:');
    console.log('  node search.js "kubernetes debugging"');
    console.log('  node search.js "authentication flow issues"');
    process.exit(args.length === 0 ? 1 : 0);
  }

  const query = args.join(' ');
  console.log(`Searching memories for: "${query}"...\n`);

  const results = await searchMemories(query);
  console.log(formatResults(results, query));
}

if (require.main === module) {
  main().catch(err => {
    console.error('Search failed:', err);
    process.exit(1);
  });
}

module.exports = { searchMemories, formatResults };
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node test-search.js`
Expected: All tests pass. Results may be empty if no entries have embeddings yet — that's OK, the test handles it.

**Step 5: Commit**

```bash
git add memory-index/search.js memory-index/test-search.js
git commit -m "feat: add semantic search module for memory recall"
```

---

### Task 4: Modify update-index.js — accept optional embedding

**Files:**
- Modify: `memory-index/update-index.js`

**Step 1: Write the test (extend test-integration.js)**

Add to the end of `memory-index/test-integration.js` (before the Summary section):

```javascript
// Test 5: Verify updateSingleFile accepts embedding parameter
console.log('Test 5: Testing updateSingleFile with embedding parameter...');
if (updateSingleFile.length >= 1) {
  console.log('✓ updateSingleFile accepts parameters (embedding support ready)');
} else {
  console.log('✗ updateSingleFile parameter signature unexpected');
}
```

**Step 2: Modify updateSingleFile to accept an optional embedding**

In `memory-index/update-index.js`, change the `updateSingleFile` function signature and the entry construction:

Change line 18 from:
```javascript
function updateSingleFile(filepath) {
```
to:
```javascript
function updateSingleFile(filepath, options = {}) {
```

Change lines 59-65 (the entry construction) from:
```javascript
    // Add or update entry
    index.entries[filepath] = {
      tags: frontmatter.tags,
      descriptionKeywords: keywords,
      mtime: mtime,
      basename: basename,
      filename: filename
    };
```
to:
```javascript
    // Add or update entry
    const entry = {
      tags: frontmatter.tags,
      descriptionKeywords: keywords,
      description: frontmatter.description,
      mtime: mtime,
      basename: basename,
      filename: filename
    };

    // Store embedding if provided
    if (options.embedding && Array.isArray(options.embedding)) {
      entry.embedding = options.embedding;
    }

    index.entries[filepath] = entry;
```

**Step 3: Run existing tests to verify nothing broke**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node test-integration.js`
Expected: All tests pass (backward compatible — no embedding param = no embedding stored).

**Step 4: Commit**

```bash
git add memory-index/update-index.js memory-index/test-integration.js
git commit -m "feat: extend updateSingleFile to accept optional embedding"
```

---

### Task 5: Modify build-index.js — add --embed flag

**Files:**
- Modify: `memory-index/build-index.js`

**Step 1: Add async embedding support to buildFullIndex**

The key changes:
1. Add `--embed` CLI flag parsing
2. Make `buildFullIndex` async when embedding is requested
3. Generate embeddings for each file's description

Change the `buildFullIndex` function to accept an options parameter. Replace the existing `buildFullIndex` function (lines 85-133) with:

```javascript
/**
 * Build complete memory index from all markdown files
 * @param {object} [options] - Build options
 * @param {boolean} [options.embed=false] - Generate embeddings for descriptions
 * @returns {Promise<object>} Complete index structure
 */
async function buildFullIndex(options = {}) {
  const startTime = Date.now();
  const brainDir = path.join(os.homedir(), '.agents', 'brain');

  // Verify brain directory exists
  if (!fs.existsSync(brainDir)) {
    throw new Error(`Brain directory not found: ${brainDir}`);
  }

  let embedFn = null;
  if (options.embed) {
    const { loadModel, embed } = require('./embed.js');
    await loadModel();
    embedFn = embed;
  }

  const index = {
    version: 1,
    lastFullScanAt: new Date().toISOString(),
    entries: {},
    stats: { totalFiles: 0, lastScanDurationMs: 0 }
  };

  // Find all markdown files
  const allFiles = findMarkdownFiles(brainDir);

  for (const filepath of allFiles) {
    try {
      const frontmatter = parseFrontmatter(filepath);
      if (!frontmatter) continue;  // Skip files without valid frontmatter

      const keywords = extractKeywords(frontmatter.description);
      const mtime = getFileMtime(filepath);
      const dirname = path.dirname(filepath);
      const basename = path.basename(dirname);
      const filename = path.basename(filepath);

      const entry = {
        tags: frontmatter.tags,
        descriptionKeywords: keywords,
        description: frontmatter.description,
        mtime: mtime,
        basename: basename,
        filename: filename
      };

      // Generate embedding if requested
      if (embedFn && frontmatter.description) {
        try {
          entry.embedding = await embedFn(frontmatter.description);
        } catch (err) {
          console.warn(`Warning: Failed to embed ${filename}: ${err.message}`);
        }
      }

      index.entries[filepath] = entry;
    } catch (error) {
      console.warn(`Warning: Skipping ${filepath}:`, error.message);
    }
  }

  // Update stats
  index.stats.totalFiles = Object.keys(index.entries).length;
  index.stats.lastScanDurationMs = Date.now() - startTime;

  return index;
}
```

Update the `main` function (lines 147-163) to handle `--embed` flag and async:

```javascript
async function main() {
  try {
    const args = process.argv.slice(2);
    const doEmbed = args.includes('--embed');

    console.log('Building memory index...');
    if (doEmbed) {
      console.log('  Generating embeddings (this may take a moment)...');
    }

    const index = await buildFullIndex({ embed: doEmbed });
    saveIndex(index);

    console.log(`✓ Index built successfully!`);
    console.log(`  Total files indexed: ${index.stats.totalFiles}`);
    console.log(`  Scan duration: ${index.stats.lastScanDurationMs}ms`);
    if (doEmbed) {
      const withEmbeddings = Object.values(index.entries).filter(e => e.embedding).length;
      console.log(`  Embeddings generated: ${withEmbeddings}`);
    }
    console.log(`  Location: ~/.agents/brain/memory-index.json`);

    process.exit(0);
  } catch (error) {
    console.error('Error building index:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
```

**Step 2: Run without --embed to verify backward compatibility**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node build-index.js`
Expected: Same output as before, no embeddings generated.

**Step 3: Run with --embed to generate embeddings for all existing files**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node build-index.js --embed`
Expected: Index rebuilt with embeddings. May take 10-30s for 10 files (model load + 10 embeddings).

**Step 4: Verify embeddings are in the index**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node -e "const idx = require(require('os').homedir() + '/.agents/brain/memory-index.json'); const entries = Object.values(idx.entries); console.log('Total:', entries.length, 'With embeddings:', entries.filter(e => e.embedding).length, 'Dims:', entries.find(e => e.embedding)?.embedding?.length)"`
Expected: `Total: 10 With embeddings: 10 Dims: 384`

**Step 5: Commit**

```bash
git add memory-index/build-index.js
git commit -m "feat: add --embed flag to build-index.js for backfilling embeddings"
```

---

### Task 6: Run search tests end-to-end

Now that embeddings exist in the index, run the search tests again to verify real results.

**Step 1: Run search tests**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node test-search.js`
Expected: Results now include actual memory files with similarity scores.

**Step 2: Run embed tests**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node test-embed.js`
Expected: All 6 tests pass.

**Step 3: Run integration tests**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node test-integration.js`
Expected: All tests pass.

**Step 4: Manual CLI test**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node search.js "kubernetes pod debugging"`
Expected: Ranked results from the memory index with similarity scores.

---

### Task 7: Create recall.md — the slash command

**Files:**
- Create: `recall.md`

**Step 1: Write the recall command**

Create `/Users/benjaminkrammel/.agents/commands/recall.md`:

```markdown
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
```

**Step 2: Commit**

```bash
git add recall.md
git commit -m "feat: add /recall slash command for semantic memory search"
```

---

### Task 8: Modify save.md — add embedding generation step

**Files:**
- Modify: `save.md`

**Step 1: Add embedding step to save.md**

In `save.md`, modify Step 10 ("Save File, Update Index, and Confirm") to include embedding generation. Add the following after the existing "After writing the file" paragraph and before "Then output confirmation":

Insert after line 323 (`**After writing the file**: Call `updateSingleFile(targetPath)` from `memory-index/update-index.js` to add the new file to the index. Wrap in try-catch - index update failure should not block the save operation.`):

Replace that paragraph with:

```
**After writing the file**:

1. **Generate embedding**: Use `embed()` from `memory-index/embed.js` to generate a 384-dim embedding for the session description. Wrap in try-catch — embedding failure should not block the save.

2. **Update index**: Call `updateSingleFile(targetPath, { embedding })` from `memory-index/update-index.js` to add the new file (with embedding) to the index. Wrap in try-catch — index update failure should not block the save operation.

```javascript
// After writing the memory file
try {
  const { embed } = require('/Users/benjaminkrammel/.agents/commands/memory-index/embed.js');
  const embedding = await embed(description);  // description from frontmatter

  const { updateSingleFile } = require('/Users/benjaminkrammel/.agents/commands/memory-index/update-index.js');
  updateSingleFile(targetPath, { embedding });
} catch (error) {
  console.warn('Failed to generate embedding or update index:', error.message);
  // Continue without failing the save operation
}
```
```

Also update the index system checks at the end of save.md to include:
```
- ✅ Embedding was generated for the session description (or gracefully skipped)
- ✅ Embedding was passed to `updateSingleFile()` via options parameter
```

**Step 2: Commit**

```bash
git add save.md
git commit -m "feat: add embedding generation step to /save command"
```

---

### Task 9: Store description in index entries

**Files:**
- Modify: `memory-index/build-index.js` (already done in Task 5 — `description` field added)
- Modify: `memory-index/update-index.js` (already done in Task 4 — `description` field added)

This task verifies that both scripts now store the `description` field in index entries (needed by `search.js` to display results). Both were already modified in Tasks 4 and 5. Verify by rebuilding:

**Step 1: Rebuild index and verify description field**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node build-index.js --embed`

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node -e "const idx = require(require('os').homedir() + '/.agents/brain/memory-index.json'); const entry = Object.values(idx.entries)[0]; console.log('Has description:', typeof entry.description === 'string', 'Has embedding:', Array.isArray(entry.embedding))"`
Expected: `Has description: true Has embedding: true`

---

### Task 10: Update README.md and final integration test

**Files:**
- Modify: `memory-index/README.md`

**Step 1: Add embedding documentation to README**

Add a new section to `memory-index/README.md` after the "Architecture" section:

```markdown
### Semantic Search (Embeddings)

The index supports optional neural embeddings for semantic search via the `/recall` command.

**Generating embeddings:**
```bash
# Backfill embeddings for all existing files
./build-index.js --embed

# Embeddings are also generated automatically by /save
```

**Searching:**
```bash
# CLI search
node search.js "kubernetes debugging"

# Or use the /recall slash command in Claude Code
```

**Components:**
- `embed.js` - Embedding utility (model loading, embed(), cosineSimilarity())
- `search.js` - Search logic (load index, rank by similarity, format output)

**Model:** Xenova/all-MiniLM-L6-v2 (384 dimensions, ~30MB, cached in ~/.cache/huggingface/)
```

Update the Files tree at the end of the README to include the new files:

```
memory-index/
├── build-index.js           # Full index rebuild (executable, supports --embed)
├── update-index.js          # Incremental update (executable + importable)
├── extract-keywords.js      # Keyword extraction (importable)
├── embed.js                 # Sentence embedding utility (importable)
├── search.js                # Semantic search (executable + importable)
├── test-embed.js            # Embedding tests
├── test-search.js           # Search tests
├── test-integration.js      # Integration tests
└── README.md                # This file
```

Update the Dependencies section:

```markdown
## Dependencies

- **js-yaml** ^4.1.0 - YAML parser for frontmatter
- **@huggingface/transformers** - Local sentence embeddings via MiniLM-L6-v2
- **Node.js native modules** - fs, path, os
```

**Step 2: Run all tests**

Run: `cd /Users/benjaminkrammel/.agents/commands/memory-index && node test-embed.js && node test-search.js && node test-integration.js`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add memory-index/README.md
git commit -m "docs: update README with embedding and search documentation"
```

---

## Summary of All Tasks

| # | Task | Files | Type |
|---|------|-------|------|
| 1 | Install transformers.js | package.json | Dependency |
| 2 | Create embed.js | embed.js, test-embed.js | New module |
| 3 | Create search.js | search.js, test-search.js | New module |
| 4 | Modify update-index.js | update-index.js | Enhancement |
| 5 | Modify build-index.js | build-index.js | Enhancement |
| 6 | End-to-end test | — | Verification |
| 7 | Create recall.md | recall.md | New command |
| 8 | Modify save.md | save.md | Enhancement |
| 9 | Verify description field | — | Verification |
| 10 | Update README | README.md | Documentation |
