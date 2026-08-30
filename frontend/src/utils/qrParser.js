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
export const extractQRCode = (payload) => {
  if (!payload || typeof payload !== 'string') return null;

  const trimmed = payload.trim();

  // Pattern 1: Short code format "OBJECT:123" or "MUSEUM:123"
  if (trimmed.toUpperCase().startsWith('OBJECT:')) {
    const id = trimmed.substring(7);
    return id.length > 0 ? { type: 'object', id } : null;
  }
  if (trimmed.toUpperCase().startsWith('MUSEUM:')) {
    const id = trimmed.substring(7);
    return id.length > 0 ? { type: 'museum', id } : null;
  }

  // Pattern 2: URL or Path "/objects/123" or "/museums/123"
  try {
    const url = trimmed.startsWith('http') ? new URL(trimmed) : new URL(trimmed, 'https://museum.internal');
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    if (pathParts.length === 2) {
      if (pathParts[0] === 'objects') return { type: 'object', id: pathParts[1] };
      if (pathParts[0] === 'museums') return { type: 'museum', id: pathParts[1] };
    }
  } catch (e) {
  }

  return null;
};
