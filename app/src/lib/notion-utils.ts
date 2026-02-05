/**
 * Extracts the Notion Page ID from a URL or string.
 * Supports standard Notion URLs (https://www.notion.so/..., https://notion.site/...)
 * and raw IDs (with or without dashes).
 */
export function getNotionPageId(urlOrId: string): string | null {
    if (!urlOrId) return null;

    // If it's a raw UUID (with or without dashes), try to format it
    const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
    // If it matches UUID structure but no dashes, we might want to normalize it?
    // Actually notion-to-md might handle raw 32-char hex.

    try {
        const urlObj = new URL(urlOrId);
        // Path usually ends with ID: /Page-Title-3c2230209...
        const pathSegments = urlObj.pathname.split('/');
        const lastSegment = pathSegments[pathSegments.length - 1];

        // Pattern: Title-ID (ID is 32 hex chars at the end)
        const match = lastSegment.match(/([0-9a-f]{32})$/);
        if (match) {
            return match[1];
        }
        // Pattern: just ID
        if (lastSegment.match(/^[0-9a-f]{32}$/)) {
            return lastSegment;
        }
    } catch {
        // Not a URL, try regex on string
        const match = urlOrId.match(/([0-9a-f]{32})/);
        if (match) {
            return match[1];
        }
    }

    // Fallback for simple ID inputs (dashes support)
    if (uuidRegex.test(urlOrId)) {
        return urlOrId;
    }

    return null;
}
