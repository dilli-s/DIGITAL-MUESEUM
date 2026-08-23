/**
 * Validates and extracts an object ID from a museum QR code payload.
 *
 * Supported formats:
 * - https://example.com/objects/123
 * - http://localhost:5173/objects/123
 * - /objects/123
 * - OBJECT:123
 *
 * @param {string} payload - The raw string from the QR code scanner
 * @returns {string|null} - Returns the object ID if valid, null otherwise.
 */
export const extractObjectId = (payload) => {
  if (!payload || typeof payload !== 'string') return null;

  const trimmed = payload.trim();

  // Pattern 1: Short code format "OBJECT:123"
  if (trimmed.toUpperCase().startsWith('OBJECT:')) {
    const id = trimmed.substring(7);
    return id.length > 0 ? id : null;
  }

  // Pattern 2: URL or Path "/objects/123"
  try {
    // If it's a full URL, parse it. If it's a relative path, mock a base domain.
    const url = trimmed.startsWith('http') ? new URL(trimmed) : new URL(trimmed, 'https://museum.internal');
    
    // Path should be like /objects/123
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    if (pathParts.length === 2 && pathParts[0] === 'objects') {
      return pathParts[1];
    }
  } catch (e) {
    // Not a valid URL or path pattern
  }

  return null;
};
