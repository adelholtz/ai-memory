---
description: Save technical findings and learnings from the current session
argument-hint: [custom-filename]
---

# Save Session Memory

## Overview

Automatically analyze the current session, extract technical findings and learnings, and save them to `~/.agents/brain/<current-directory-name>/memory-YYYYMMDD-HHMMSS.md`.

This command captures technical discoveries, patterns, solutions, code changes, and insights for future reference.

## Usage

```bash
/save                                # Save with auto-generated timestamp filename
/save my-findings                    # Custom filename, auto-generated tags
/save my-findings --tags k8s,debug   # Custom filename + user tags merged with auto-generated
```

Note: The first positional argument is the filename. Tags provided via `--tags` are comma-separated and merged with auto-generated tags (deduplicated). If `--tags` is omitted, only auto-generated tags are used.

## Implementation Instructions

Follow these steps carefully to analyze the session and create a comprehensive memory file.

### Step 1: Gather Environment Context

Use bash commands to collect environment information:

```bash
# Get current working directory
pwd

# Get basename for folder name
basename $(pwd)

# Get git repository name (optional, for display only)
basename $(git rev-parse --show-toplevel 2>/dev/null) || echo "N/A"

# Generate timestamps
date +"%Y%m%d-%H%M%S"           # For filename: 20260205-143022
date +"%Y-%m-%d %H:%M:%S"       # For document: 2026-02-05 14:30:22
```

Store these values for use in later steps.

### Step 2: Determine Output Filename

Process the filename based on user input:

```
If $ARGUMENTS is empty or not provided:
  filename = "memory-" + YYYYMMDD-HHMMSS + ".md"
  Example: memory-20260205-143022.md
Else:
  filename = $ARGUMENTS
  If filename does NOT end with ".md":
    filename = filename + ".md"
  
  Examples:
  - "my-findings" → "my-findings.md"
  - "debug.md" → "debug.md"
```

### Step 3: Construct Target Path

Build the full path where the file will be saved:

```
basename = $(basename $(pwd))
target_dir = ~/.agents/brain/$basename
target_path = $target_dir/$filename
```

Example:
- Working dir: `/Users/name/projects/my-app`
- Basename: `my-app`
- Target dir: `~/.agents/brain/my-app`
- Target path: `~/.agents/brain/my-app/memory-20260205-143022.md`

### Step 4: Handle File Conflicts

If the target file already exists, append a numeric suffix:

```
original_filename = filename
base_name = filename without ".md" extension
counter = 2

While file exists at target_path:
  filename = base_name + "-" + counter + ".md"
  target_path = target_dir + "/" + filename
  counter = counter + 1

Example conflict resolution:
- memory-20260205-143022.md exists
- Try memory-20260205-143022-2.md
- If that exists, try memory-20260205-143022-3.md
- Continue until finding available filename
```

### Step 5: Create Directory Structure

Ensure the target directory exists:

```bash
mkdir -p ~/.agents/brain/$basename
```

This creates both `~/.agents/brain/` and the project subdirectory if needed.

### Step 6: Discover Related Sessions

Search through ALL markdown files in ~/.agents/brain to find sessions with matching content based on frontmatter analysis. This step uses a memory index cache (`~/.agents/brain/memory-index.json`) to avoid repeatedly parsing all files.

#### Index File System

**Location**: `~/.agents/brain/memory-index.json`

**Purpose**: Cache pre-extracted metadata (tags, description keywords, mtime) for fast session discovery.

**Benefits**:
- **Performance**: 91% faster for typical runs (~28ms vs 330ms)
- **Scalability**: Handles 100+ memory files efficiently (~30ms vs 33+ seconds)
- **Automatic**: Index updates incrementally, no user action required

**Schema**:
```json
{
  "version": 1,
  "lastFullScanAt": "2026-02-09T14:15:22.000Z",
  "entries": {
    "/absolute/path/to/memory-file.md": {
      "tags": ["tag1", "tag2", "tag3"],
      "descriptionKeywords": ["keyword1", "keyword2"],
      "mtime": 1770642732,
      "basename": "project-name",
      "filename": "memory-20260209-141055.md"
    }
  },
  "stats": {
    "totalFiles": 6,
    "lastScanDurationMs": 28
  }
}
```

#### Keyword Extraction Algorithm

Extracts 5-10 technical terms from description text:

1. Split description on whitespace
2. Lowercase all words
3. Strip punctuation from word boundaries
4. Filter out:
   - Words < 3 characters
   - Common stopwords (the, a, an, is, was, were, are, with, for, from, this, that, these, those, has, have, had, been, will, would, could, should, may, might, can, must, shall, into, onto, upon, about, after, before, during, while, since, until, unless, because, although, though, when, where, which, what, who, whom, whose, why, how, than, then, there, their, them, they, some, many, more, most, much, very, only, just, also, even, still, yet, both, each, every, either, neither, nor, but, and, or, not, to, of, in, on, at, by, as, if, it)
5. Keep technical terms:
   - Alphabetic words
   - Hyphenated terms (e.g., "ci-cd", "zmk-firmware")
6. Deduplicate while preserving order
7. Return first 10 keywords

**Example**:
- Input: "Modified /save command's Session Metadata section to streamline metadata collection"
- Output: `["modified", "save", "command", "session", "metadata", "section", "streamline", "collection"]`

#### Matching Criteria

A file is considered "related" if it meets **either** of these conditions:
1. **Tag Overlap**: Shares 2 or more tags with the current session
2. **Similar Description**: Has 2 or more matching keywords (extracted via algorithm above)

#### Implementation Steps

**Use the memory index utilities** from `memory-index/`:
- `extract-keywords.js` - Keyword extraction algorithm
- Index file at `~/.agents/brain/memory-index.json` - Pre-built metadata cache

1. **Load index** (auto-rebuilds if missing/corrupt)
2. **Extract keywords** from current session description using `extractKeywords()`
3. **Match related sessions** by comparing:
   - Tag overlap (2+ shared tags qualify)
   - Keyword matches (2+ shared keywords qualify)
   - Score = (tag_overlap × 2) + keyword_matches
4. **Rank by score** and take top 5 matches
5. **Generate relative paths** and format as markdown links
```markdown
**Related Sessions**:
- [filename1.md](./filename1.md) - 4 shared tags: api, python, debugging, database
- [../other-project/filename2.md](../other-project/filename2.md) - 3 shared tags: kubernetes, ci-cd, docker
- [filename3.md](./filename3.md) - Similar content: authentication, jwt, security
```

If no related sessions found:
```markdown
**Related Sessions**: None
```

#### Error Handling & Fallback

**Critical**: Index operations must NEVER block `/save` execution.

**Fallback behavior**:
- Wrap all index operations in try-catch
- If ANY index operation fails → fall back to direct filesystem scan
- Log warning but continue with session save
- This ensures `/save` always completes successfully

**Failure scenarios handled**:
- Missing/corrupted index → Auto-rebuilds via `build-index.js`
- Permission denied → Falls back to filesystem scan
- Invalid YAML in files → Skips file, continues with others
- Version mismatch → Auto-rebuilds index

#### Implementation Reference

**Memory index utilities** (fully implemented in `memory-index/`):
- `extract-keywords.js` - Keyword extraction function
- `build-index.js` - Full index rebuild (auto-runs if needed)
- `update-index.js` - Incremental updates (call after saving)
- `README.md` - Complete documentation and examples

**Usage**: Import the utilities and use the pre-built index at `~/.agents/brain/memory-index.json` for fast session matching.

#### Technical Notes

- **Use memory-index utilities**: Pre-built Node.js scripts handle all index operations
  - `build-index.js`: Full rebuild (auto-called if index missing/corrupt)
  - `update-index.js`: Updates index after saving new files
  - `extract-keywords.js`: Consistent keyword extraction algorithm
- **YAML parsing**: Uses `js-yaml` library (industry standard)
- **Error handling**: All scripts handle edge cases (missing frontmatter, invalid YAML, corrupted files)
- **Automatic recovery**: Corrupted index auto-rebuilds via `build-index.js`
- **Fallback behavior**: If index operations fail, fall back to filesystem scan
- **Performance**: Index operations complete in < 100ms for typical setups, < 150ms for 50+ files
- **Incremental updates**: `updateSingleFile()` adds new entries without full rebuild
- **No manual maintenance**: Index updates automatically on each `/save` execution

### Step 7: Collect Metadata

Attempt to collect session metadata, using "N/A" for unavailable information:

- **Model**: Use "claude-sonnet-4.5" (from system context)
- **CLI Used**: Try to detect which CLI tool is being used (e.g., "Claude Code", "OpenCode", etc.). If unavailable, use "N/A"

Example:
```markdown
**Session Metadata**:
- Model: claude-sonnet-4.5
- CLI Used: Claude Code
```

### Step 8: Analyze Conversation History

Review the **entire conversation** from start to finish and extract:

#### Technical Findings
- **Key Discoveries**: Major technical findings about code, architecture, systems, performance
- **Patterns Identified**: Design patterns, code patterns, anti-patterns observed or implemented
- **Solutions & Approaches**: Problems encountered, solutions implemented, why specific approaches were chosen

#### Learnings & Insights
- **Technical Lessons**: Specific lessons about languages, frameworks, tools, behaviors
- **Best Practices**: Practices identified, reinforced, or discovered
- **Gotchas & Edge Cases**: Non-obvious behaviors, pitfalls, edge cases to watch for

#### Code Changes
- **Files Modified**: High-level summary of changes made to existing files
- **Files Created**: New files, modules, or components added and their purposes
- **Architecture Impact**: How changes affect overall system architecture, new dependencies

#### Tools & Technologies
- **Tools Used**: Development tools, CLI utilities, scripts created
- **Libraries & Frameworks**: Libraries explored, integrated, or configured
- **Configuration Changes**: Environment variables, config files, infrastructure changes

#### Outstanding Items
- **Action Items**: Tasks remaining to be completed
- **Future Considerations**: Ideas for improvement, features to add later
- **Open Questions**: Questions needing investigation, uncertainties to resolve

#### References
- **Documentation**: Official docs, blog posts, articles consulted
- **Related Files**: Key files in the codebase referenced
- **Commands Reference**: Useful commands discovered or scripts created

#### Tags
Auto-extract tags from the session content. Extract from these categories:
- **Task types**: `debugging`, `feature`, `refactoring`, `exploration`, `configuration`, `documentation`
- **Languages/frameworks**: Languages and frameworks mentioned or used (e.g., `python`, `react`, `kubernetes`, `typescript`)
- **Tools**: Development tools used (e.g., `git`, `docker`, `terraform`, `webpack`)
- **Domain**: Domain-specific tags (e.g., `api`, `frontend`, `database`, `ci-cd`, `auth`, `testing`)

Tag formatting rules:
- All lowercase
- Hyphen-separated (no spaces or underscores)
- Concise (1-2 words per tag)
- Aim for 3-8 tags total that accurately characterize the session

### Step 9: Generate Memory File

Using the **template below**, populate all sections with the extracted information.

**Important guidelines:**
- **All sections must be present** in the output
- **For empty sections**: Use "None in this session" or similar rather than leaving blank
- **Be concise**: Focus on information valuable for future reference
- **Be accurate**: Ensure file paths, code references, technical details are correct
- **Use proper markdown**: Correct heading levels, lists, code blocks, links
- **Session Context**: Write 2-4 sentences summarizing what was worked on
- **Frontmatter**: Place YAML frontmatter at the very top of the file (before `# Technical Memory`):
  - `description`: Reuse the same 2-4 sentence overview written for Session Context
  - `tags`: Combine auto-generated tags with any user-provided `--tags` values, deduplicated
  - Format tags as a YAML inline list: `[tag1, tag2, tag3]`

### Step 10: Save File, Update Index, and Confirm

Write the generated content to the target file and output a confirmation message.

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

**Then output confirmation**:

```
✓ Session memory saved successfully!

Location: ~/.agents/brain/<basename>/<filename>
Sections populated: X/9
Main findings: 
  - [Most important finding 1]
  - [Most important finding 2]
  - [Most important finding 3]

Related sessions: X previous sessions linked
```

If fewer than 3 main findings, list what's available. If no significant findings, note that.

## Memory File Template

Use this exact template structure when generating the memory file:

```markdown
---
description: [Same 2-4 sentence overview as Session Context]
tags: [auto-generated-tag-1, auto-generated-tag-2, user-tag-1]
---

# Technical Memory - [Project Name/Basename]

**Date**: YYYY-MM-DD HH:MM:SS
**Working Directory**: /full/path/to/directory  
**Repository**: [git repo name if applicable, or "N/A"]

**Session Metadata**:
- Model: claude-sonnet-4.5
- CLI Used: [CLI name or "N/A"]

**Related Sessions**: 
[List of up to 3 most recent memory-*.md files with links, or "None"]

---

## Session Context

[Brief 2-4 sentence overview of what was worked on during this session]

---

## Technical Findings

### Key Discoveries
[Major technical findings made during the session, or "None in this session"]

### Patterns Identified
[Design patterns observed or implemented, or "None in this session"]

### Solutions & Approaches
[Problems encountered and how they were solved, or "None in this session"]

---

## Learnings & Insights

### Technical Lessons
[Specific technical lessons learned, or "None in this session"]

### Best Practices
[Best practices identified or reinforced, or "None in this session"]

### Gotchas & Edge Cases
[Edge cases discovered, pitfalls to avoid, or "None in this session"]

---

## Code Changes Summary

### Files Modified
[High-level overview of changes, or "No files modified"]

### Files Created
[New files/modules added, or "No files created"]

### Architecture Impact
[How changes affect overall architecture, or "No architectural impact"]

---

## Tools & Technologies

### Tools Used
[Development tools utilized, or "No new tools used"]

### Libraries & Frameworks
[New libraries explored or integrated, or "No new libraries"]

### Configuration Changes
[Environment variables, config files updated, or "No configuration changes"]

---

## Outstanding Items

### Action Items
[Tasks that remain to be completed, or "None"]

### Future Considerations
[Ideas for improvement, features to add later, or "None"]

### Open Questions
[Questions needing investigation, or "None"]

---

## References

### Documentation
[Official docs, articles referenced, or "None"]

### Related Files
[Key files in the codebase, or "None"]

### Commands Reference
[Useful commands discovered, or "None"]

---

## Notes

[Additional observations or context that doesn't fit elsewhere, or "None"]
```

## Quality Checks

Before saving the file, verify:

- ✅ All timestamps are accurate and in correct format
- ✅ Paths are correct and absolute where specified
- ✅ Markdown formatting is valid (headers, lists, links)
- ✅ Technical content is accurate (file paths, code references)
- ✅ Cross-references point to actual existing files
- ✅ Related sessions links are valid and files exist
- ✅ Related sessions show accurate match reasons (shared tags or keywords)
- ✅ Frontmatter parsing worked correctly for all candidate files
- ✅ Metadata shows "N/A" where unavailable (not blank or error messages)
- ✅ Sections contain "None" or similar if truly empty (not generic boilerplate)
- ✅ Frontmatter is valid YAML (proper `---` delimiters, correct `description` and `tags` field names)
- ✅ Tags are lowercase and hyphen-separated (no spaces, underscores, or uppercase)
- ✅ Description in frontmatter matches the Session Context content
- ✅ File was successfully written to disk
- ✅ Filename conflict resolution worked if needed

**Index System Checks**:
- ✅ Index was loaded successfully or auto-rebuilt via `build-index.js` if missing/corrupt
- ✅ `updateSingleFile()` was called after saving the memory file
- ✅ Keyword extraction produced relevant technical terms (using `extract-keywords.js`)
- ✅ Related sessions matched correctly using tag overlap and keyword similarity
- ✅ If index operations failed, fallback to filesystem scan worked correctly
- ✅ Session discovery completed in < 100ms (or < 150ms for 50+ files)
- ✅ Embedding was generated for the session description (or gracefully skipped)
- ✅ Embedding was passed to `updateSingleFile()` via options parameter
- ✅ Memory index utilities are available at `/Users/benjaminkrammel/.agents/commands/memory-index/`

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| No meaningful technical content | Create minimal file noting "Brief session with no significant technical findings" |
| Permission denied writing to `~/.agents/brain/` | Alert user with clear error message and path that failed |
| Not in git repository | Set Repository field to "N/A" |
| Very long session (>50 turns) | Prioritize most important findings, summarize repetitive work |
| Multiple working directories during session | Note all directories in Session Context |
| Unable to detect metadata | Use "N/A" for all unavailable metadata fields |
| Custom filename without extension | Auto-append `.md` extension |
| File conflict (many existing versions) | Keep incrementing suffix (-2, -3, -4, etc.) |
| Empty conversation | Create file noting minimal session activity |

## Example Outputs

### Example 1: Technical Session

```
✓ Session memory saved successfully!

Location: ~/.agents/brain/opencode-commands/memory-20260205-143522.md
Sections populated: 8/9
Main findings: 
  - Created new /save command for capturing session insights
  - Discovered OpenCode commands use markdown instruction files
  - Implemented file conflict resolution with numeric suffixes

Related sessions: 2 previous sessions linked
```

### Example 2: Brief Session

```
✓ Session memory saved successfully!

Location: ~/.agents/brain/my-app/memory-20260205-091033.md
Sections populated: 3/9
Main findings: 
  - Brief exploratory session reviewing codebase structure

Related sessions: None
```

### Example 3: Custom Filename with Cross-Project Matches

```
✓ Session memory saved successfully!

Location: ~/.agents/brain/infra/kubernetes-debugging.md
Sections populated: 7/9
Main findings:
  - Identified pod restart loop caused by misconfigured liveness probe
  - Discovered memory leak in data processing container
  - Implemented resource limits to prevent OOM kills

Related sessions: 5 matches found across projects
  - 2 from current project (infra)
  - 3 from other projects (api-service, monitoring, devops-tools)
  Top match: ../api-service/container-optimization.md (5 shared tags)
```

## Notes

- This command is designed to capture technical value from sessions for future reference
- The standardized template ensures consistency across all memory files
- Automatic analysis reduces manual effort while maintaining quality
- **Intelligent cross-referencing**: Frontmatter-based matching discovers related work across ALL projects, not just within the same directory
- Files are organized by project (directory basename) for easy navigation
- **Smart matching**: Combines tag overlap and semantic description analysis to find truly relevant sessions
- **Cross-project insights**: Helps identify patterns and solutions across different codebases working with similar technologies
- **Performance optimization**: Memory index cache (`~/.agents/brain/memory-index.json`) provides 91% faster session discovery (~28ms vs 330ms) and scales gracefully to 100+ memory files
- **Memory index utilities**: Complete implementation available at `/Users/benjaminkrammel/.agents/commands/memory-index/`
  - `build-index.js` - Full index rebuild (executable)
  - `update-index.js` - Incremental single-file updates (executable + importable)
  - `extract-keywords.js` - Keyword extraction algorithm (importable)
  - `README.md` - Complete documentation with usage examples
- **Automatic maintenance**: Index updates automatically via `updateSingleFile()` after each save
- **Robust fallback**: If index operations fail, system automatically falls back to filesystem scan, ensuring `/save` never blocks
- **Dependencies**: Requires `js-yaml` package (install via `npm install` in memory-index directory)
