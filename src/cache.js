const CACHE_KEY_PREFIX = 'explain_cache_';
const CACHE_INDEX_KEY = 'explain_cache_index';
const MAX_CACHE_SIZE = 100;

export const generateCacheKey = (errorMessage, codeSnippet, language, explanationStyle) => {
  const normalizedError = (errorMessage || '').trim().toLowerCase();
  const normalizedCode = (codeSnippet || '').trim().toLowerCase();
  const normalizedLang = (language || '').trim().toLowerCase();
  const normalizedStyle = (explanationStyle || '').trim().toLowerCase();
  
  const rawKey = `${normalizedError}|${normalizedCode}|${normalizedLang}|${normalizedStyle}`;
  
  // Simple hash function for string to create a shorter, consistent key
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    const char = rawKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `${CACHE_KEY_PREFIX}${hash}`;
};

const getCacheIndex = () => {
  try {
    const indexStr = localStorage.getItem(CACHE_INDEX_KEY);
    if (indexStr) {
      return JSON.parse(indexStr);
    }
  } catch (e) {
    console.error('Failed to parse cache index', e);
  }
  return []; // Array of keys, ordered from oldest to newest
};

const saveCacheIndex = (index) => {
  try {
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.error('Failed to save cache index', e);
  }
};

export const getCachedResult = (key) => {
  try {
    const cachedData = localStorage.getItem(key);
    if (cachedData) {
      // Update LRU - move to end
      let index = getCacheIndex();
      index = index.filter(k => k !== key);
      index.push(key);
      saveCacheIndex(index);
      
      return JSON.parse(cachedData);
    }
  } catch (e) {
    console.error('Failed to get cached result', e);
  }
  return null;
};

export const setCachedResult = (key, parsedResult, rawResponse) => {
  try {
    const dataToCache = {
      parsedResult,
      rawResponse,
      timestamp: Date.now()
    };
    
    localStorage.setItem(key, JSON.stringify(dataToCache));
    
    let index = getCacheIndex();
    
    // Remove if already exists to update its position
    index = index.filter(k => k !== key);
    index.push(key);
    
    // Enforce size limit
    if (index.length > MAX_CACHE_SIZE) {
      const keysToRemove = index.slice(0, index.length - MAX_CACHE_SIZE);
      index = index.slice(index.length - MAX_CACHE_SIZE);
      
      keysToRemove.forEach(k => {
        localStorage.removeItem(k);
      });
    }
    
    saveCacheIndex(index);
  } catch (e) {
    console.error('Failed to save cached result', e);
  }
};
