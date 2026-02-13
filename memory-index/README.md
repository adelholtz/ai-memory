# Memory Index Management

The memory index system provides fast metadata lookup for session discovery in the `/save` command. It pre-extracts tags and description keywords from all memory files in `~/.agents/brain`, enabling quick session discovery without scanning every markdown file on disk.

## Purpose

The `/save` command needs to discover related sessions by matching:
- Frontmatter tags
- Description keywords

Without indexing, this requires parsing ALL markdown files (330ms for small sets, 33+ seconds for 100+ files).

With indexing, lookups are **~28ms vs 330ms (91% faster)** and scale gracefully to 100+ files.

## Architecture

### Index Structure

The index is stored at `~/.agents/brain/memory-index.json`:

```json
{
  "version": 1,
  "lastFullScanAt": "2026-02-10T12:34:56.789Z",
  "entries": {
    "/Users/user/.agents/brain/my-project/memory-20260210.md": {
      "tags": ["kubernetes", "docker", "ci-cd"],
      "descriptionKeywords": ["debugging", "kubernetes", "pod", "restart", "loop"],
      "description": "Debugging kubernetes pod restart loop in production",
      "mtime": 1707567896,
      "basename": "my-project",
      "filename": "memory-20260210.md",
      "embedding": [0.123, -0.456, ...] // Optional: 384-dim vector, present if --embed was used
    }
  },
  "stats": {
    "totalFiles": 42,
    "lastScanDurationMs": 87
  }
}
```

### Components

1. **extract-keywords.js** - Keyword extraction algorithm
   - Filters stopwords (the, a, with, etc.)
   - Keeps technical terms (≥3 chars, alphabetic or hyphenated)
   - Returns up to 10 keywords per description

2. **build-index.js** - Full index rebuild script
   - Recursively scans `~/.agents/brain`
   - Parses YAML frontmatter from all .md files
   - Extracts tags, description, and keywords
   - Optionally generates embeddings with `--embed` flag
   - Stores: tags, descriptionKeywords, description, mtime, basename, filename, (optional) embedding
   - CLI executable: `./build-index.js` or `./build-index.js --embed`

3. **update-index.js** - Incremental update utility
   - Adds/updates a single file's metadata in the index
   - Stores the same fields as build-index.js
   - Accepts optional embedding via options parameter
   - Used by `/save` command after saving each memory file
   - CLI executable: `./update-index.js <filepath>`
   - Importable: `require('./update-index.js').updateSingleFile(filepath, options)`

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
- `embed.js` - Embedding utility (exports: loadModel(), embed(), cosineSimilarity())
- `search.js` - Search logic (exports: searchMemories(), formatResults(); CLI: node search.js "query")

**Model:** Xenova/all-MiniLM-L6-v2 (384 dimensions, ~30MB, cached in ~/.cache/huggingface/)

## Usage

### Initial Setup

1. Install dependency:
   ```bash
   cd memory-index
   npm install
   ```

2. Build the initial index:
   ```bash
   cd memory-index
   ./build-index.js
   ```

   Output:
   ```
   Building memory index...
   ✓ Index built successfully!
     Total files indexed: 42
     Scan duration: 87ms
     Location: ~/.agents/brain/memory-index.json
   ```

### Rebuilding the Index

Rebuild the entire index from scratch:

```bash
cd memory-index
./build-index.js
```

**When to rebuild:**
- First time setup
- After bulk file operations
- If index becomes corrupted
- Periodically (weekly/monthly) to catch missed updates

### Updating a Single File

Update the index after modifying a memory file:

```bash
cd memory-index
./update-index.js ~/.agents/brain/my-project/memory-20260210.md
```

Output:
```
✓ Updated index for: memory-20260210.md
  Tags: kubernetes, docker, ci-cd
  Keywords: debugging, kubernetes, pod, restart, loop
```

**Usage in code:**
```javascript
const { updateSingleFile } = require('./memory-index/update-index.js');

// After saving a memory file (without embedding)
updateSingleFile('/Users/user/.agents/brain/my-project/memory-20260210.md');

// Or with embedding (for semantic search support)
const { embed } = require('./memory-index/embed.js');
const description = 'Debugging kubernetes pod restart loop';
const embedding = await embed(description);
updateSingleFile('/Users/user/.agents/brain/my-project/memory-20260210.md', { embedding });
```

### Reading the Index

The `/save` command reads the index for session discovery:

```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');

const indexPath = path.join(os.homedir(), '.agents', 'brain', 'memory-index.json');

try {
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  // Find sessions with matching tags
  const matchingSessions = Object.entries(index.entries)
    .filter(([filepath, meta]) =>
      meta.tags.some(tag => currentTags.includes(tag))
    );

  // Find sessions with matching keywords
  const keywordMatches = Object.entries(index.entries)
    .filter(([filepath, meta]) =>
      meta.descriptionKeywords.some(kw => currentKeywords.includes(kw))
    );
} catch (error) {
  // Fall back to filesystem scanning if index not available
  console.warn('Index not available, falling back to filesystem scan');
}
```

## Error Handling

All scripts include comprehensive error handling:

- **Invalid YAML**: Warnings logged, file skipped (doesn't fail entire operation)
- **Missing files**: Clear error messages, appropriate exit codes
- **Corrupted index**: Detected and recreated automatically
- **Permission errors**: Logged and skipped gracefully

### Fallback Strategy

If any index operation fails, the `/save` command should fall back to direct filesystem scanning. The index is an optimization, not a requirement.

## Performance Benchmarks

From the save.md specification:

| Scenario | Without Index | With Index | Improvement |
|----------|--------------|------------|-------------|
| Small (10 files) | 330ms | 28ms | 91% faster |
| Medium (50 files) | ~1.6s | ~30ms | 98% faster |
| Large (100+ files) | 33+ seconds | ~30ms | 99.9% faster |

**Index build times:**
- Typical setup (< 20 files): < 100ms
- Large setup (50+ files): < 150ms

## Integration with /save Command

The `/save` command will:

1. **After saving a memory file**: Call `updateSingleFile()` to add it to the index
2. **During session discovery**: Read from index instead of scanning filesystem
3. **On index errors**: Fall back to filesystem scanning

Integration example:
```javascript
// In save command, after writing memory file
const { updateSingleFile } = require('./memory-index/update-index.js');

try {
  updateSingleFile(memoryFilePath);
  // Or with embedding for semantic search:
  // const { embed } = require('./memory-index/embed.js');
  // const embedding = await embed(frontmatter.description);
  // updateSingleFile(memoryFilePath, { embedding });
} catch (error) {
  console.warn('Failed to update index, continuing anyway:', error.message);
  // Continue without failing the save operation
}
```

## Troubleshooting

### Index not found
```bash
# Build it for the first time
./build-index.js
```

### Stale entries in index
```bash
# Rebuild from scratch
./build-index.js
```

### Corrupted index file
```bash
# Delete and rebuild
rm ~/.agents/brain/memory-index.json
./build-index.js
```

### Missing keywords
Check that:
1. Description exists in frontmatter
2. Description contains technical terms (not just stopwords)
3. Terms are ≥3 characters
4. Keywords are alphabetic or hyphenated

### Slow performance
- Index should be < 100ms for typical setups
- If slower, check for very large directories or slow disk I/O
- Consider rebuilding index to clean up stale entries

## Maintenance

### Regular Tasks

1. **Weekly**: Rebuild index to catch any missed updates
   ```bash
   ./build-index.js
   ```

2. **After bulk operations**: Always rebuild
   ```bash
   # After moving/renaming many files
   ./build-index.js
   ```

3. **Monitor index size**: Check stats in memory-index.json
   ```bash
   cat ~/.agents/brain/memory-index.json | jq '.stats'
   ```

## Dependencies

- **js-yaml** ^4.1.0 - YAML parser for frontmatter
- **@huggingface/transformers** ^3.8.1 - Local sentence embeddings via MiniLM-L6-v2
- **Node.js native modules** - fs, path, os

## Files

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

## See Also

- `/save` command specification: `../save.md`
- Session manager utilities: `../session-manager/`
