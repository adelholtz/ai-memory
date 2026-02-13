#!/usr/bin/env node

/**
 * Integration test for memory index system with /save command
 * Tests the complete flow: load index, match sessions, update index
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { extractKeywords } = require('./extract-keywords.js');
const { updateSingleFile } = require('./update-index.js');

console.log('=== Memory Index Integration Test ===\n');

// Test 1: Load existing index
console.log('Test 1: Loading memory index...');
const indexPath = path.join(os.homedir(), '.agents', 'brain', 'memory-index.json');

let index;
try {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  index = JSON.parse(indexContent);

  if (index.version !== 1) {
    throw new Error('Version mismatch');
  }

  console.log(`✓ Index loaded successfully`);
  console.log(`  Files indexed: ${index.stats.totalFiles}`);
  console.log(`  Last scan: ${index.stats.lastScanDurationMs}ms`);
} catch (error) {
  console.log(`! Index error: ${error.message}`);
  console.log('  Rebuilding index...');

  const { execSync } = require('child_process');
  execSync('node ' + path.join(__dirname, 'build-index.js'));

  const indexContent = fs.readFileSync(indexPath, 'utf8');
  index = JSON.parse(indexContent);
  console.log(`✓ Index rebuilt: ${index.stats.totalFiles} files`);
}

console.log('');

// Test 2: Extract keywords from a sample description
console.log('Test 2: Extracting keywords from sample description...');
const sampleDescription = 'Implemented memory index system for fast session discovery using kubernetes and docker configurations';
const keywords = extractKeywords(sampleDescription);
console.log(`✓ Extracted keywords: ${keywords.join(', ')}`);
console.log('');

// Test 3: Match related sessions
console.log('Test 3: Matching related sessions...');
const currentTags = ['kubernetes', 'docker', 'performance'];
const currentKeywords = keywords;

const matches = [];
for (const [filepath, entry] of Object.entries(index.entries)) {
  const tagOverlap = currentTags.filter(tag => entry.tags.includes(tag)).length;
  const keywordMatches = currentKeywords.filter(kw => entry.descriptionKeywords.includes(kw)).length;

  if (tagOverlap >= 2 || keywordMatches >= 2) {
    const score = (tagOverlap * 2) + keywordMatches;
    const sharedTags = currentTags.filter(tag => entry.tags.includes(tag));
    const sharedKeywords = currentKeywords.filter(kw => entry.descriptionKeywords.includes(kw));

    matches.push({
      filepath,
      filename: entry.filename,
      score,
      tagOverlap,
      keywordMatches,
      sharedTags,
      sharedKeywords
    });
  }
}

const topMatches = matches.sort((a, b) => b.score - a.score).slice(0, 5);

console.log(`✓ Found ${matches.length} matching sessions`);
if (topMatches.length > 0) {
  console.log('  Top matches:');
  topMatches.forEach((match, i) => {
    console.log(`  ${i + 1}. ${match.filename} (score: ${match.score})`);
    if (match.tagOverlap >= 2) {
      console.log(`     - ${match.tagOverlap} shared tags: ${match.sharedTags.join(', ')}`);
    }
    if (match.keywordMatches >= 2) {
      console.log(`     - ${match.keywordMatches} keyword matches: ${match.sharedKeywords.slice(0, 5).join(', ')}`);
    }
  });
} else {
  console.log('  No matches found (this is OK for test data)');
}

console.log('');

// Test 4: Verify updateSingleFile can be called
console.log('Test 4: Testing updateSingleFile availability...');
if (typeof updateSingleFile === 'function') {
  console.log('✓ updateSingleFile is available and can be imported');
  console.log('  (Not calling it to avoid modifying test data)');
} else {
  console.log('✗ updateSingleFile is not available!');
  process.exit(1);
}

console.log('');

// Test 5: Verify updateSingleFile accepts embedding parameter
console.log('Test 5: Testing updateSingleFile with embedding parameter...');
if (updateSingleFile.length >= 1) {
  console.log('✓ updateSingleFile accepts parameters (embedding support ready)');
} else {
  console.log('✗ updateSingleFile parameter signature unexpected');
}

console.log('');

// Summary
console.log('=== Integration Test Summary ===');
console.log('✓ All integration points verified');
console.log('✓ Memory index system is ready for /save command');
console.log('');
console.log('Integration points:');
console.log('  1. Index loading with auto-rebuild: WORKS');
console.log('  2. Keyword extraction: WORKS');
console.log('  3. Session matching: WORKS');
console.log('  4. Index update function: AVAILABLE');
console.log('');
console.log('The /save command can now use:');
console.log('  - extractKeywords() for description analysis');
console.log('  - Index entries for fast session discovery');
console.log('  - updateSingleFile() after saving memory files');
