# AI Agent Stuff

This repository contains documentation and commands for AI agent workflows.

## Contents

### save.md
A comprehensive command specification for saving technical findings and learnings from agent sessions. This command automatically analyzes the current session, extracts technical insights, and saves them to `~/.agents/brain/<project-name>/memory-YYYYMMDD-HHMMSS.md`.

**Key Features:**
- Automatic session analysis and memory capture
- Structured template for consistent documentation
- Smart filename conflict resolution
- Cross-referencing with related sessions
- Organized by project directory

**Usage Examples:**
```bash
/save                           # Auto-generated timestamp filename
/save my-findings               # Custom filename (auto-appends .md)
/save kubernetes-debug.md       # Specific filename with extension
```

**What Gets Captured:**
- Technical findings and discoveries
- Code changes and architecture impacts
- Tools, libraries, and configuration changes
- Best practices and lessons learned
- Outstanding items and future considerations

The command creates comprehensive memory files with standardized sections for easy future reference and knowledge retention across sessions.
