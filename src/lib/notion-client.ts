import { config } from '../config.js';
import type { NotionResult } from '../types/index.js';

// Notion API へのリクエストオプション
interface NotionRequestOptions {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: Record<string, unknown>;
  // クエリパラメータ（filter_properties 等）
  queryParams?: Record<string, string | string[]>;
}

// Notion API エラーレスポンス
interface NotionErrorBody {
  code: string;
  message: string;
}

function getToken(): string {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error('NOTION_TOKEN is not set. Set it in your environment or .env file.');
  }
  return token;
}

// クエリパラメータをURLSearchParamsに変換
function buildQueryString(params: Record<string, string | string[]>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        searchParams.append(key, v);
      }
    } else {
      searchParams.append(key, value);
    }
  }
  return searchParams.toString();
}

export async function notionRequest<T>(options: NotionRequestOptions): Promise<NotionResult<T>> {
  const token = getToken();
  let url = `${config.notion.baseUrl}${options.path}`;

  if (options.queryParams) {
    const qs = buildQueryString(options.queryParams);
    if (qs) {
      url += `?${qs}`;
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': config.notion.apiVersion,
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({
      code: 'unknown',
      message: response.statusText,
    }))) as NotionErrorBody;

    return {
      ok: false,
      status: response.status,
      code: errorBody.code ?? 'unknown',
      message: errorBody.message ?? response.statusText,
    };
  }

  const data = (await response.json()) as T;
  return { ok: true, data };
}
