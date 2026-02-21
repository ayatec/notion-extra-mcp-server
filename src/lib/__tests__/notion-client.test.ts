import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notionRequest } from '../notion-client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NOTION_TOKEN', 'test-token');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('notionRequest', () => {
  it('正しいヘッダーとURLでリクエストを構築する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: '123' }),
    });

    await notionRequest({ method: 'GET', path: '/data_sources/ds-123' });

    expect(mockFetch).toHaveBeenCalledWith('https://api.notion.com/v1/data_sources/ds-123', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
        'Notion-Version': '2025-09-03',
      },
      body: undefined,
    });
  });

  it('POSTリクエストでbodyとContent-Typeを送信する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    await notionRequest({
      method: 'POST',
      path: '/data_sources/ds-123/query',
      body: { page_size: 10 },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.notion.com/v1/data_sources/ds-123/query',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ page_size: 10 }),
      }),
    );
  });

  it('クエリパラメータを正しく付与する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    await notionRequest({
      method: 'POST',
      path: '/data_sources/ds-123/query',
      body: {},
      queryParams: { filter_properties: ['prop1', 'prop2'] },
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('filter_properties=prop1');
    expect(calledUrl).toContain('filter_properties=prop2');
  });

  it('成功レスポンスで ok: true を返す', async () => {
    const data = { id: '123', object: 'page' };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const result = await notionRequest({ method: 'GET', path: '/pages/123' });

    expect(result).toEqual({ ok: true, data });
  });

  it('エラーレスポンスで ok: false を返す', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () =>
        Promise.resolve({
          code: 'object_not_found',
          message: 'Could not find page with ID: 123',
        }),
    });

    const result = await notionRequest({ method: 'GET', path: '/pages/123' });

    expect(result).toEqual({
      ok: false,
      status: 404,
      code: 'object_not_found',
      message: 'Could not find page with ID: 123',
    });
  });

  it('JSONパース失敗時にstatusTextをフォールバックとして使う', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('invalid json')),
    });

    const result = await notionRequest({ method: 'GET', path: '/pages/123' });

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: 'unknown',
      message: 'Internal Server Error',
    });
  });

  it('NOTION_TOKEN未設定でエラーをスローする', async () => {
    vi.stubEnv('NOTION_TOKEN', '');

    await expect(notionRequest({ method: 'GET', path: '/pages/123' })).rejects.toThrow(
      'NOTION_TOKEN is not set',
    );
  });
});
