# AI Agent Stuff

A knowledge management system for AI agent sessions with semantic search capabilities. This repository provides tools to capture, organize, and retrieve technical learnings from AI coding sessions.

## Overview

This project implements two main commands for AI agents (like Claude Code, Copilot, etc.):

- **`/save`** - Captures session findings and learnings with automatic analysis and cross-referencing
- **`/recall`** - Semantic search across all saved sessions using natural language queries

Both commands leverage a high-performance memory index system that enables intelligent session discovery and cross-project knowledge retention.

## Key Features

### 🧠 Intelligent Session Capture (`/save`)
- **Automatic analysis** - Extracts technical insights, patterns, and learnings from conversations
- **Smart cross-referencing** - Links related sessions using tag overlap and semantic keyword matching
- **Cross-project discovery** - Finds relevant work across ALL projects, not just current directory
- **Structured templates** - Consistent documentation with frontmatter metadata
- **Auto-tagging** - Automatically extracts relevant tags from session content

### 🔍 Semantic Search (`/recall`)
- **Natural language queries** - Search using plain language: "kubernetes debugging", "API authentication issues"
- **Neural embeddings** - Finds semantically similar sessions using MiniLM-L6-v2 model
- **Fast retrieval** - ~200-300ms search latency across 100+ sessions
- **Offline operation** - Runs locally with no API keys or external dependencies

### ⚡ High-Performance Index System
- **91% faster** than filesystem scanning (~28ms vs 330ms)
- **Scales efficiently** - Handles 100+ memory files in < 150ms
- **Automatic maintenance** - Index updates incrementally with each save
- **Keyword extraction** - Smart algorithm filters stopwords, keeps technical terms
- **Graceful fallback** - Falls back to filesystem scan if index unavailable

## Quick Start

### Installation

1. Clone this repository:
```bash
git clone https://github.com/adelholtz/ai-agent-stuff.git
cd ai-agent-stuff
```

2. Install dependencies for the memory-index system:
```bash
cd memory-index
npm install
```

3. Build the initial index (optional, created automatically on first `/save`):
```bash
./build-index.js
```

4. For semantic search, generate embeddings:
```bash
./build-index.js --embed
```

### Usage

#### Saving Session Learnings

```bash
/save                                # Auto-generated timestamp filename
/save my-findings                    # Custom filename (auto-appends .md)
/save kubernetes-debug.md            # Specific filename with extension
/save my-findings --tags k8s,debug   # Custom tags merged with auto-generated
```

**What gets captured:**
- Session metadata and context
- Technical findings and discoveries
- Code changes and architecture impacts
- Tools, libraries, and configuration
- Best practices and lessons learned
- Outstanding items and future work
- Related sessions via intelligent matching

**Output location:** `~/.agents/brain/<project-name>/memory-YYYYMMDD-HHMMSS.md`

#### Searching Past Sessions

```bash
/recall kubernetes network debugging
/recall "how did I fix the authentication bug?"
/recall helm chart configuration issues
/recall docker container memory leak
```

**Output:**
```
Searching 10 memories...

1. [0.89] config-service/memory-20260212-134206.md
   "Diagnosed and fixed a Kubernetes deployment caching issue..."
   Tags: kubernetes, helm, docker, ci-cd

2. [0.76] commands/memory-20260209-110856.md
   "Performed systematic Kubernetes diagnostics..."
   Tags: kubernetes, diagnostics, debugging

Found 2 relevant memories (threshold: 0.3)
```

## Documentation

### Command Specifications
- **[save.md](./save.md)** - Complete `/save` command specification with 10-step implementation guide
- **[recall.md](./recall.md)** - `/recall` semantic search command specification and usage

### Memory Index System
- **[memory-index/README.md](./memory-index/README.md)** - Index architecture, performance benchmarks, and maintenance guide

### Design Documents
- **[docs/plans/](./docs/plans/)** - Architecture decisions and implementation plans for semantic recall

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent Session                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │   /save cmd    │ ──────► Analyze session
        └────────┬───────┘         Extract insights
                 │                 Generate tags
                 ▼
        ┌────────────────┐
        │  Generate      │ ──────► MiniLM-L6-v2 model
        │  Embedding     │         384-dim vector
        └────────┬───────┘
                 │
                 ▼
        ┌────────────────┐
        │  Update Index  │ ──────► ~/.agents/brain/memory-index.json
        └────────┬───────┘         Tags, keywords, embedding
                 │
                 ▼
        ┌────────────────┐
        │   Save File    │ ──────► ~/.agents/brain/<project>/memory-*.md
        └────────────────┘         Structured markdown with frontmatter


┌─────────────────────────────────────────────────────────────┐
│                  Search for Past Work                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │  /recall cmd   │ ──────► Natural language query
        └────────┬───────┘
                 │
                 ▼
        ┌────────────────┐
        │  Load Index &  │ ──────► memory-index.json
        │  Embeddings    │         All session vectors
        └────────┬───────┘
                 │
                 ▼
        ┌────────────────┐
        │  Cosine        │ ──────► Rank by similarity
        │  Similarity    │         Return top 5 matches
        └────────┬───────┘
                 │
                 ▼
        ┌────────────────┐
        │  Format &      │ ──────► Display results
        │  Display       │         Offer to read files
        └────────────────┘
```

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Session discovery (with index) | ~28ms | 91% faster than filesystem scan |
| Session discovery (without index) | ~330ms | Filesystem scan fallback |
| Large codebase (100+ files) | ~30ms | Index scales efficiently |
| Embedding generation | ~170ms | Per session description |
| Semantic search | ~200-300ms | Includes model load + search |
| Index rebuild | < 100ms | Typical setup (< 20 files) |

## Components

### Memory Index Utilities (`memory-index/`)
- **build-index.js** - Full index rebuild (supports `--embed` flag)
- **update-index.js** - Incremental updates after each save
- **extract-keywords.js** - Keyword extraction algorithm
- **embed.js** - Sentence embedding utility (MiniLM-L6-v2)
- **search.js** - Semantic search logic
- **test-*.js** - Test suites for embeddings, search, and integration

### Dependencies
- **js-yaml** - YAML frontmatter parsing
- **@huggingface/transformers** - Local neural embeddings (MiniLM-L6-v2)
- Node.js built-in modules (fs, path, os)

## Contributing

This is a personal project for AI agent workflow optimization. Feel free to fork and adapt for your own use.

## License

MIT (or specify your license)
