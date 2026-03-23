// Notion API レスポンスの Result 型
export type NotionResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string };

// MCP ツールレスポンス（MCP SDKのインデックスシグネチャ要件に対応）
export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
}

// batch-update-pages の個別結果
export interface BatchUpdateResult {
  page_id: string;
  success: boolean;
  error?: string;
}

// batch-update-pages の全体結果
export interface BatchUpdateSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchUpdateResult[];
  guidance?: string;
}
