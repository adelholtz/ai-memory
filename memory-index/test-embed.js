#!/usr/bin/env node

/**
 * Test for embed.js — embedding utility
 */

const { cosineSimilarity, embed, loadModel } = require('./embed.js');

async function runTests() {
  console.log('=== Embed Module Tests ===\n');

  // Test 1: cosineSimilarity — pure math, no model needed
  console.log('Test 1: cosineSimilarity with identical vectors...');
  const vecA = [1, 0, 0];
  const vecB = [1, 0, 0];
  const sim1 = cosineSimilarity(vecA, vecB);
  console.assert(Math.abs(sim1 - 1.0) < 0.001, `Expected ~1.0, got ${sim1}`);
  console.log(`✓ Identical vectors: ${sim1.toFixed(4)}`);

  console.log('Test 2: cosineSimilarity with orthogonal vectors...');
  const sim2 = cosineSimilarity([1, 0, 0], [0, 1, 0]);
  console.assert(Math.abs(sim2) < 0.001, `Expected ~0.0, got ${sim2}`);
  console.log(`✓ Orthogonal vectors: ${sim2.toFixed(4)}`);

  console.log('Test 3: cosineSimilarity with opposite vectors...');
  const sim3 = cosineSimilarity([1, 0], [-1, 0]);
  console.assert(Math.abs(sim3 - (-1.0)) < 0.001, `Expected ~-1.0, got ${sim3}`);
  console.log(`✓ Opposite vectors: ${sim3.toFixed(4)}`);

  // Test 4: Load model and embed text
  console.log('\nTest 4: Loading model (this may download ~30MB on first run)...');
  await loadModel();
  console.log('✓ Model loaded');

  console.log('Test 5: Embed a sentence...');
  const embedding = await embed('kubernetes pod debugging');
  console.assert(Array.isArray(embedding), 'Embedding should be an array');
  console.assert(embedding.length === 384, `Expected 384 dims, got ${embedding.length}`);
  console.assert(typeof embedding[0] === 'number', 'Elements should be numbers');
  console.log(`✓ Embedding: ${embedding.length} dimensions, first 3: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}]`);

  // Test 6: Similar sentences should have high similarity
  console.log('Test 6: Semantic similarity — related sentences...');
  const emb1 = await embed('kubernetes pod restart debugging');
  const emb2 = await embed('k8s container crash troubleshooting');
  const emb3 = await embed('chocolate cake recipe ingredients');
  const simRelated = cosineSimilarity(emb1, emb2);
  const simUnrelated = cosineSimilarity(emb1, emb3);
  console.assert(simRelated > simUnrelated, `Related (${simRelated.toFixed(4)}) should be > unrelated (${simUnrelated.toFixed(4)})`);
  console.log(`✓ Related: ${simRelated.toFixed(4)}, Unrelated: ${simUnrelated.toFixed(4)}`);

  console.log('\n=== All embed tests passed ===');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
