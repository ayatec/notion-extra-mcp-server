import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findByUniqueIdHandler, findByUniqueIdSchema } from '../find-by-unique-id.js';

vi.mock('../../lib/notion-client.js', () => ({
  notionRequest: vi.fn(),
}));

import { notionRequest } from '../../lib/notion-client.js';

const mockNotionRequest = vi.mocked(notionRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

// テスト用スキーマレスポンス
const schemaResponse = {
  ok: true as const,
  data: {
    properties: {
      ID: { id: 'uid1', name: 'ID', type: 'unique_id', unique_id: { prefix: 'TEST' } },
      名前: { id: 'title', name: '名前', type: 'title', title: {} },
    },
  },
};

// テスト用ページレスポンス
const pageData = {
  id: 'page-1',
  url: 'https://www.notion.so/page-1',
  created_time: '2026-01-01T00:00:00.000Z',
  properties: {
    名前: {
      id: 'title',
      type: 'title',
      title: [{ plain_text: 'テスト' }],
    },
    ID: {
      id: 'uid1',
      type: 'unique_id',
      unique_id: { prefix: 'TEST', number: 1 },
    },
  },
};

describe('find-by-unique-id', () => {
  describe('findByUniqueIdSchema', () => {
    it('必須パラメータのみでデフォルト値が適用される', () => {
      const result = findByUniqueIdSchema.parse({
        data_source_id: 'ds-123',
        unique_id: 'TEST-1',
      });
      expect(result.compact).toBe(false);
      expect(result.include_content).toBe(false);
    });

    it('unique_id が空文字でエラー', () => {
      expect(() =>
        findByUniqueIdSchema.parse({ data_source_id: 'ds-123', unique_id: '' }),
      ).toThrow();
    });
  });

  describe('findByUniqueIdHandler', () => {
    it('プレフィックス付きIDでページを検索する', async () => {
      mockNotionRequest
        .mockResolvedValueOnce(schemaResponse) // スキーマ取得
        .mockResolvedValueOnce({
          ok: true,
          data: { results: [pageData] },
        }); // クエリ

      const result = await findByUniqueIdHandler({
        data_source_id: 'ds-123',
        unique_id: 'TEST-1',
        compact: false,
        include_content: false,
      });

      // スキーマ取得が呼ばれた
      expect(mockNotionRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET', path: '/data_sources/ds-123' }),
      );
      // unique_id フィルタでクエリ
      expect(mockNotionRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/data_sources/ds-123/query',
          body: {
            filter: { property: 'ID', unique_id: { equals: 1 } },
            page_size: 1,
          },
        }),
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe('page-1');
    });

    it('数値のみのIDでも検索できる', async () => {
      mockNotionRequest.mockResolvedValueOnce(schemaResponse).mockResolvedValueOnce({
        ok: true,
        data: { results: [pageData] },
      });

      await findByUniqueIdHandler({
        data_source_id: 'ds-123',
        unique_id: '42',
        compact: false,
        include_content: false,
      });

      expect(mockNotionRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            filter: { property: 'ID', unique_id: { equals: 42 } },
            page_size: 1,
          },
        }),
      );
    });

    it('compact: true でフラット化されたレスポンスを返す', async () => {
      mockNotionRequest.mockResolvedValueOnce(schemaResponse).mockResolvedValueOnce({
        ok: true,
        data: { results: [pageData] },
      });

      const result = await findByUniqueIdHandler({
        data_source_id: 'ds-123',
        unique_id: 'TEST-1',
        compact: true,
        include_content: false,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.properties['名前']).toBe('テスト');
      expect(parsed.properties['ID']).toBe('TEST-1');
      // メタデータが除外されている
      expect(parsed).not.toHaveProperty('created_time');
    });

    it('include_content: true でページ本文を含む', async () => {
      mockNotionRequest
        .mockResolvedValueOnce(schemaResponse)
        .mockResolvedValueOnce({
          ok: true,
          data: { results: [pageData] },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: { markdown: '## 見出し\n\n本文テキスト' },
        });

      const result = await findByUniqueIdHandler({
        data_source_id: 'ds-123',
        unique_id: 'TEST-1',
        compact: false,
        include_content: true,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.content).toBe('## 見出し\n\n本文テキスト');
      // Markdown取得APIが呼ばれた
      expect(mockNotionRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET', path: '/pages/page-1/markdown' }),
      );
    });

    it('ページが見つからない場合にエラーを返す', async () => {
      mockNotionRequest.mockResolvedValueOnce(schemaResponse).mockResolvedValueOnce({
        ok: true,
        data: { results: [] },
      });

      const result = await findByUniqueIdHandler({
        data_source_id: 'ds-123',
        unique_id: 'TEST-999',
        compact: false,
        include_content: false,
      });

      expect(result.content[0].text).toContain('No page found');
      expect(result).toHaveProperty('isError', true);
    });

    it('unique_id プロパティが無い場合にエラーを返す', async () => {
      mockNotionRequest.mockResolvedValueOnce({
        ok: true,
        data: {
          properties: {
            名前: { id: 'title', type: 'title', title: {} },
          },
        },
      });

      const result = await findByUniqueIdHandler({
        data_source_id: 'ds-123',
        unique_id: 'TEST-1',
        compact: false,
        include_content: false,
      });

      expect(result.content[0].text).toContain('No unique_id property found');
      expect(result).toHaveProperty('isError', true);
    });
  });
});
