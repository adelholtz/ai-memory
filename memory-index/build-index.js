#!/usr/bin/env node

/**
 * Memory Index Builder
 * Scans all .md files in ~/.agents/brain and builds a complete metadata index
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const { extractKeywords } = require('./extract-keywords.js');

/**
 * Parse YAML frontmatter from a markdown file
 * @param {string} filepath - Path to the markdown file
 * @returns {object|null} Parsed frontmatter with tags and description, or null if invalid
 */
function parseFrontmatter(filepath) {
  try {
    // Read file content
    const content = fs.readFileSync(filepath, 'utf8');

    // Extract YAML frontmatter between --- delimiters
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    // Parse YAML using js-yaml
    const frontmatter = yaml.load(match[1]);
    return {
      tags: frontmatter.tags || [],
      description: frontmatter.description || ''
    };
  } catch (error) {
    console.warn(`Warning: Invalid YAML in ${filepath}:`, error.message);
    return null;
  }
}

/**
 * Get file modification time in Unix timestamp (seconds)
 * @param {string} filepath - Path to the file
 * @returns {number} Unix timestamp in seconds
 */
function getFileMtime(filepath) {
  const stats = fs.statSync(filepath);
  return Math.floor(stats.mtimeMs / 1000);
}

/**
 * Recursively find all .md files in a directory
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of absolute file paths
 */
function findMarkdownFiles(dir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          files.push(...findMarkdownFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      } catch (error) {
        console.warn(`Warning: Skipping ${fullPath}:`, error.message);
        continue;
      }
    }
  } catch (error) {
    console.warn(`Warning: Cannot read directory ${dir}:`, error.message);
  }

  return files;
}

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

/**
 * Save index to disk
 * @param {object} index - Index structure to save
 */
function saveIndex(index) {
  const indexPath = path.join(os.homedir(), '.agents', 'brain', 'memory-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
}

/**
 * Main CLI entry point
 */
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

// Allow both CLI execution and module import
if (require.main === module) {
  main();
}

module.exports = { buildFullIndex, parseFrontmatter, saveIndex };
