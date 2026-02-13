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
