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
