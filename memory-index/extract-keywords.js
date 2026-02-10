/**
 * Keyword extraction utility for memory index
 * Extracts meaningful keywords from session descriptions
 */

function extractKeywords(description) {
  // Stopwords list from save.md specification
  const stopwords = new Set([
    "the", "a", "an", "is", "was", "were", "are", "with", "for", "from",
    "to", "of", "in", "on", "at", "by", "this", "that", "be", "been",
    "has", "have", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "about", "into", "through", "during",
    "before", "after", "above", "below", "between", "under", "again",
    "further", "then", "once", "here", "there", "when", "where", "why",
    "how", "all", "both", "each", "few", "more", "most", "other", "some",
    "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
    "very", "just", "but", "or", "and", "if", "as", "what", "which", "who",
    "whom", "whose", "these", "those", "am", "being", "any", "every", "many"
  ]);

  // Split, lowercase, strip punctuation
  const words = description.toLowerCase().split(/\s+/);
  const keywords = [];

  for (const word of words) {
    // Strip punctuation from boundaries
    const cleaned = word.replace(/^[.,!?;:()\[\]{}\"']+|[.,!?;:()\[\]{}\"']+$/g, '');

    // Filter: length >= 3, not stopword
    if (cleaned.length < 3 || stopwords.has(cleaned)) continue;

    // Keep alphabetic or hyphenated terms (e.g., "ci-cd", "zmk-firmware")
    if (/^[a-z]+$/.test(cleaned) || /^[a-z]+-[a-z-]+$/.test(cleaned)) {
      if (!keywords.includes(cleaned)) {  // Deduplicate
        keywords.push(cleaned);
      }
    }
  }

  return keywords.slice(0, 10);  // Return first 10
}

module.exports = { extractKeywords };
