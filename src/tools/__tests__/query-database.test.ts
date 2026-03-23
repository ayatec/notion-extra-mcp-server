import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryDatabaseHandler, queryDatabaseSchema } from '../query-database.js';

vi.mock('../../lib/notion-client.js', () => ({
  notionRequest: vi.fn(),
}));

vi.mock('../../utils/rate-limiter.js', () => ({
  RateLimiter: class {
    async wait() {}
  },
}));

import { notionRequest } from '../../lib/notion-client.js';

const mockNotionRequest = vi.mocked(notionRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('query-database', () => {
  describe('queryDatabaseSchema', () => {
    it('data_source_id のみでデフォルト値が適用される', () => {
      const result = queryDatabaseSchema.parse({ data_source_id: 'ds-123' });
      expect(result.data_source_id).toBe('ds-123');
      expect(result.page_size).toBe(100);
    });

    it('data_source_id が空文字でエラー', () => {
      expect(() => queryDatabaseSchema.parse({ data_source_id: '' })).toThrow();
    });

    it('page_size が101以上でエラー', () => {
      expect(() =>
        queryDatabaseSchema.parse({ data_source_id: 'ds-123', page_size: 101 }),
      ).toThrow();
    });
  });

  describe('queryDatabaseHandler', () => {
    it('成功レスポンスを返す', async () => {
      const apiResponse = { results: [], has_more: false, next_cursor: null };
      mockNotionRequest.mockResolvedValue({ ok: true, data: apiResponse });

      const result = await queryDatabaseHandler({
        data_source_id: 'ds-123',
        page_size: 100,
      });

      expect(JSON.parse(result.content[0].text)).toEqual(apiResponse);
      expect(result).not.toHaveProperty('isError');
    });

    it('filter と sorts を正しくリクエストに含める', async () => {
      mockNotionRequest.mockResolvedValue({
        ok: true,
        data: { results: [], has_more: false },
      });

      await queryDatabaseHandler({
        data_source_id: 'ds-123',
        filter: { property: 'Status', select: { equals: 'Done' } },
        sorts: [{ property: 'Created', direction: 'descending' }],
        page_size: 10,
      });

      expect(mockNotionRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/data_sources/ds-123/query',
          body: expect.objectContaining({
            filter: { property: 'Status', select: { equals: 'Done' } },
            sorts: [{ property: 'Created', direction: 'descending' }],
            page_size: 10,
          }),
        }),
      );
    });

    it('filter_properties をクエリパラメータとして送信する（ID指定）', async () => {
      // スキーマ取得 → クエリの順に呼ばれる
      mockNotionRequest
        .mockResolvedValueOnce({
          ok: true,
          data: {
            properties: {
              名前: { id: 'title', type: 'title' },
              説明: { id: 'prop1', type: 'rich_text' },
              数値: { id: 'prop2', type: 'number' },
            },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: { results: [] },
        });

      await queryDatabaseHandler({
        data_source_id: 'ds-123',
        page_size: 100,
        filter_properties: ['prop1', 'prop2'],
      });

      // クエリのコール（2番目）でIDがそのまま渡される
      expect(mockNotionRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          queryParams: { filter_properties: ['prop1', 'prop2'] },
        }),
      );
    });

    it('filter_properties のプロパティ名をIDに変換する', async () => {
      mockNotionRequest
        .mockResolvedValueOnce({
          ok: true,
          data: {
            properties: {
              名前: { id: 'title', type: 'title' },
              説明: { id: '%3DrZJ', type: 'rich_text' },
              数値: { id: 'lYUT', type: 'number' },
            },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: { results: [] },
        });

      await queryDatabaseHandler({
        data_source_id: 'ds-123',
        page_size: 100,
        filter_properties: ['名前', '数値'],
      });

      expect(mockNotionRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          queryParams: { filter_properties: ['title', 'lYUT'] },
        }),
      );
    });

    it('compact: true でフラット化されたレスポンスを返す', async () => {
      const apiResponse = {
        results: [
          {
            object: 'page',
            id: 'page-1',
            created_time: '2026-01-01T00:00:00.000Z',
            last_edited_time: '2026-01-01T00:00:00.000Z',
            created_by: { object: 'user', id: 'user-1' },
            last_edited_by: { object: 'user', id: 'user-1' },
            cover: null,
            icon: null,
            parent: { type: 'data_source_id', data_source_id: 'ds-123' },
            in_trash: false,
            is_archived: false,
            is_locked: false,
            properties: {
              名前: {
                id: 'title',
                type: 'title',
                title: [
                  {
                    type: 'text',
                    text: { content: 'テスト', link: null },
                    annotations: {
                      bold: false,
                      italic: false,
                      strikethrough: false,
                      underline: false,
                      code: false,
                      color: 'default',
                    },
                    plain_text: 'テスト',
                    href: null,
                  },
                ],
              },
              カテゴリ: {
                id: 'pNhl',
                type: 'select',
                select: { id: 'opt-1', name: 'カテゴリA', color: 'blue' },
              },
              タグ: {
                id: 'fBso',
                type: 'multi_select',
                multi_select: [
                  { id: 'ms-1', name: '重要', color: 'red' },
                  { id: 'ms-2', name: '緊急', color: 'orange' },
                ],
              },
              数値: { id: 'lYUT', type: 'number', number: 100 },
              完了: { id: 'chk1', type: 'checkbox', checkbox: false },
              期日: {
                id: 'date1',
                type: 'date',
                date: { start: '2026-04-01', end: null, time_zone: null },
              },
              URL: { id: 'url1', type: 'url', url: 'https://example.com' },
              メール: { id: 'eml1', type: 'email', email: 'test@example.com' },
            },
            url: 'https://www.notion.so/page-1',
            public_url: null,
            archived: false,
          },
        ],
        has_more: false,
        next_cursor: null,
      };
      mockNotionRequest.mockResolvedValue({ ok: true, data: apiResponse });

      const result = await queryDatabaseHandler({
        data_source_id: 'ds-123',
        page_size: 100,
        compact: true,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.results).toHaveLength(1);

      const page = parsed.results[0];
      // メタデータが除外されている
      expect(page).not.toHaveProperty('created_time');
      expect(page).not.toHaveProperty('created_by');
      expect(page).not.toHaveProperty('cover');
      expect(page).not.toHaveProperty('parent');
      // id と url は保持
      expect(page.id).toBe('page-1');
      expect(page.url).toBe('https://www.notion.so/page-1');
      // プロパティがフラット化されている
      expect(page.properties['名前']).toBe('テスト');
      expect(page.properties['カテゴリ']).toBe('カテゴリA');
      expect(page.properties['タグ']).toEqual(['重要', '緊急']);
      expect(page.properties['数値']).toBe(100);
      expect(page.properties['完了']).toBe(false);
      expect(page.properties['期日']).toBe('2026-04-01');
      expect(page.properties['URL']).toBe('https://example.com');
      expect(page.properties['メール']).toBe('test@example.com');
    });

    it('compact: false（デフォルト）で生レスポンスを返す', async () => {
      const apiResponse = {
        results: [{ id: 'page-1', properties: { 名前: { type: 'title', title: [] } } }],
        has_more: false,
      };
      mockNotionRequest.mockResolvedValue({ ok: true, data: apiResponse });

      const result = await queryDatabaseHandler({
        data_source_id: 'ds-123',
        page_size: 100,
        compact: false,
      });

      const parsed = JSON.parse(result.content[0].text);
      // 生のAPIレスポンスがそのまま返る
      expect(parsed).toEqual(apiResponse);
    });

    it('output_mode: "count" で件数のみ返す', async () => {
      mockNotionRequest.mockResolvedValue({
        ok: true,
        data: {
          results: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
          has_more: false,
          next_cursor: null,
        },
      });

      const result = await queryDatabaseHandler({
        data_source_id: 'ds-123',
        page_size: 100,
        output_mode: 'count',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({ count: 3 });
    });

    it('output_mode: "count" で複数ページをまたいでカウントする', async () => {
      mockNotionRequest
        .mockResolvedValueOnce({
          ok: true,
          data: {
            results: Array(100).fill({ id: 'p' }),
            has_more: true,
            next_cursor: 'cursor-1',
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            results: Array(50).fill({ id: 'p' }),
            has_more: false,
            next_cursor: null,
          },
        });

      const result = await queryDatabaseHandler({
        data_source_id: 'ds-123',
        page_size: 100,
        output_mode: 'count',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({ count: 150 });
      // 2回APIが呼ばれる
      expect(mockNotionRequest).toHaveBeenCalledTimes(2);
    });

    it('APIエラー時に isError: true を返す', async () => {
      mockNotionRequest.mockResolvedValue({
        ok: false,
        status: 400,
        code: 'validation_error',
        message: 'Invalid filter',
      });

      const result = await queryDatabaseHandler({
        data_source_id: 'ds-123',
        page_size: 100,
      });

      expect(result.content[0].text).toContain('validation_error');
      expect(result).toHaveProperty('isError', true);
    });
  });
});
