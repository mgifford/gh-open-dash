/**
 * Utility functions for parsing and managing organization overrides
 */

/**
 * Parse various org input formats and extract the org login
 * Accepts:
 * - Plain org name: "openplus"
 * - Full URL: "https://github.com/openplus"
 * - URL without scheme: "github.com/openplus"
 * - URLs with trailing slashes
 * 
 * @param {string} input - User input for organization
 * @returns {string|null} - Normalized org login or null if invalid
 */
export function parseOrgInput(input) {
  if (!input || typeof input !== 'string') return null;
  
  // Trim whitespace
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // Remove trailing slashes
  const normalized = trimmed.replace(/\/+$/, '');
  
  // Check if it's a URL (with or without scheme)
  const urlPatterns = [
    /^https?:\/\/github\.com\/([^\/\s]+)/i,  // https://github.com/org
    /^github\.com\/([^\/\s]+)/i,              // github.com/org
  ];
  
  for (const pattern of urlPatterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  }
  
  // If not a URL, validate as plain org name (alphanumeric, hyphens, underscores)
  if (/^[a-z0-9_-]+$/i.test(normalized)) {
    return normalized.toLowerCase();
  }
  
  return null;
}

/**
 * Get the current organization from URL query param, localStorage, or default
 * Priority: URL param > localStorage > default
 * 
 * @param {string} defaultOrg - Default organization if no override is set
 * @returns {string} - Organization to use
 */
export function getCurrentOrg(defaultOrg = 'civicactions') {
  // Check URL query parameter first
  const params = new URLSearchParams(window.location.search);
  const urlOrg = params.get('org');
  if (urlOrg) {
    const parsed = parseOrgInput(urlOrg);
    if (parsed) return parsed;
  }
  
  // Check localStorage next
  try {
    const stored = localStorage.getItem('gh-open-dash-org');
    if (stored) {
      const parsed = parseOrgInput(stored);
      if (parsed) return parsed;
    }
  } catch (e) {
    console.warn('Failed to read from localStorage:', e);
  }
  
  // Fall back to default
  return defaultOrg;
}

/**
 * Save organization override to localStorage
 * 
 * @param {string} org - Organization to save
 * @returns {boolean} - Success status
 */
export function saveOrgOverride(org) {
  try {
    if (!org) {
      localStorage.removeItem('gh-open-dash-org');
      return true;
    }
    const parsed = parseOrgInput(org);
    if (parsed) {
      localStorage.setItem('gh-open-dash-org', parsed);
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
    return false;
  }
}

/**
 * Clear organization override from localStorage
 */
export function clearOrgOverride() {
  try {
    localStorage.removeItem('gh-open-dash-org');
  } catch (e) {
    console.warn('Failed to clear localStorage:', e);
  }
}
