// Error guidance based on Notion API status codes
export function getErrorGuidance(status: number): string {
  switch (status) {
    case 400:
      return 'Request validation error. Check parameter format and property names (case-sensitive exact match required).';
    case 401:
      return 'Authentication error. Verify NOTION_TOKEN is correctly set.';
    case 403:
      return 'No access. Ensure the page/database is shared with the Notion Integration.';
    case 404:
      return 'Resource not found. Verify the ID is correct and the resource is not archived/deleted.';
    case 409:
      return 'Conflict error. Another user may be editing simultaneously. Wait and retry.';
    case 429:
      return 'Rate limited. Wait before retrying.';
    default:
      if (status >= 500) return 'Notion API server error. Wait and retry.';
      return '';
  }
}

// Format Notion API error with guidance
export function formatNotionError(status: number, code: string, message: string): string {
  const guidance = getErrorGuidance(status);
  const base = `Notion API error (${status}): [${code}] ${message}`;
  return guidance ? `${base}. ${guidance}` : base;
}
