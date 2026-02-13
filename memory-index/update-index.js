#!/usr/bin/env node

/**
 * Memory Index Updater
 * Updates the memory index with metadata from a single file
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseFrontmatter } = require('./build-index.js');
const { extractKeywords } = require('./extract-keywords.js');

/**
 * Update or add a single file's metadata in the index
 * @param {string} filepath - Absolute path to the markdown file
 * @returns {boolean} Success status
 */
function updateSingleFile(filepath, options = {}) {
  const indexPath = path.join(os.homedir(), '.agents', 'brain', 'memory-index.json');

  // Load existing index or create new one
  let index;
  try {
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    index = JSON.parse(indexContent);

    // Validate version
    if (index.version !== 1) {
      throw new Error('Index version mismatch');
    }
  } catch (error) {
    // Index doesn't exist or is corrupted - create new structure
    console.warn('Index not found or invalid, creating new entry structure');
    index = {
      version: 1,
      lastFullScanAt: new Date().toISOString(),
      entries: {},
      stats: { totalFiles: 0, lastScanDurationMs: 0 }
    };
  }

  // Parse the file
  try {
    const frontmatter = parseFrontmatter(filepath);
    if (!frontmatter) {
      console.warn(`No valid frontmatter found in ${filepath}`);
      return false;
    }

    const keywords = extractKeywords(frontmatter.description);
    const stats = fs.statSync(filepath);
    const mtime = Math.floor(stats.mtimeMs / 1000);
    const dirname = path.dirname(filepath);
    const basename = path.basename(dirname);
    const filename = path.basename(filepath);

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

    // Update stats
    index.stats.totalFiles = Object.keys(index.entries).length;
    index.lastFullScanAt = new Date().toISOString();

    // Save index
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');

    console.log(`✓ Updated index for: ${filename}`);
    console.log(`  Tags: ${frontmatter.tags.join(', ')}`);
    console.log(`  Keywords: ${keywords.slice(0, 5).join(', ')}${keywords.length > 5 ? '...' : ''}`);

    return true;
  } catch (error) {
    console.error(`Error updating index for ${filepath}:`, error.message);
    return false;
  }
}

/**
 * Main CLI entry point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: node update-index.js <filepath>');
    console.log('');
    console.log('Updates the memory index with metadata from a single file.');
    console.log('');
    console.log('Example:');
    console.log('  node update-index.js ~/.agents/brain/my-project/memory-20260210.md');
    process.exit(args.length === 0 ? 1 : 0);
  }

  const filepath = path.resolve(args[0]);

  if (!fs.existsSync(filepath)) {
    console.error(`Error: File not found: ${filepath}`);
    process.exit(1);
  }

  if (!filepath.endsWith('.md')) {
    console.error(`Error: File must be a markdown file (.md)`);
    process.exit(1);
  }

  const success = updateSingleFile(filepath);
  process.exit(success ? 0 : 1);
}

// Allow both CLI execution and module import
if (require.main === module) {
  main();
}

module.exports = { updateSingleFile };
