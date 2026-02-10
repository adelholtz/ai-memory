# AI Agent Stuff

This repository contains documentation and commands for AI agent workflows.

## Contents

### save.md
A comprehensive command specification for saving technical findings and learnings from agent sessions. This command automatically analyzes the current session, extracts technical insights, and saves them to `~/.agents/brain/<project-name>/memory-YYYYMMDD-HHMMSS.md`.

**Key Features:**
- Automatic session analysis and memory capture
- Structured template with frontmatter metadata for consistent documentation
- Smart filename conflict resolution
- **Memory index system** for 91% faster session discovery (~28ms vs 330ms)
- **Intelligent cross-referencing** using frontmatter-based tag overlap and keyword matching
- **Cross-project discovery** finds related sessions across ALL projects, not just current directory
- Organized by project directory with automatic index maintenance

**Usage Examples:**
```bash
/save                                # Auto-generated timestamp filename
/save my-findings                    # Custom filename (auto-appends .md)
/save kubernetes-debug.md            # Specific filename with extension
/save my-findings --tags k8s,debug   # Custom tags merged with auto-generated
```

**What Gets Captured:**
- **Session metadata** with frontmatter (description, auto-generated tags)
- Technical findings and discoveries
- Code changes and architecture impacts
- Tools, libraries, and configuration changes
- Best practices and lessons learned
- Outstanding items and future considerations
- **Related sessions** via intelligent tag/keyword matching across all projects

**Performance & Implementation:**
- **10-step implementation process** with detailed instructions
- **Memory index cache** (`~/.agents/brain/memory-index.json`) for fast lookups
- **Keyword extraction algorithm** for semantic description matching
- **Automatic fallback** to filesystem scan if index unavailable
- Handles 100+ memory files efficiently (< 150ms)
- Memory index utilities in `memory-index/` directory

The command creates comprehensive memory files with standardized sections, intelligent cross-referencing, and high-performance session discovery for easy future reference and knowledge retention across sessions and projects.
