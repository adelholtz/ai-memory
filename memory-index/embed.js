/**
 * Embedding utility for memory index
 * Uses @huggingface/transformers to generate sentence embeddings locally
 */

const { pipeline } = require('@huggingface/transformers');

let extractor = null;

/**
 * Load the sentence embedding model. Cached after first call.
 * Model downloads ~30MB on first use, cached in ~/.cache/huggingface/
 */
async function loadModel() {
  if (extractor) return extractor;
  extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    dtype: 'fp32',
  });
  return extractor;
}

/**
 * Generate a 384-dimensional embedding for a text string
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Array of 384 floats
 */
async function embed(text) {
  const model = await loadModel();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Compute cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Similarity score between -1 and 1
 */
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

module.exports = { loadModel, embed, cosineSimilarity };
