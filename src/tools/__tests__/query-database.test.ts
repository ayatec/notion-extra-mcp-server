import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryDatabaseHandler, queryDatabaseSchema } from '../query-database.js';

vi.mock('../../lib/notion-client.js', () => ({
  notionRequest: vi.fn(),
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

    it('filter_properties をクエリパラメータとして送信する', async () => {
      mockNotionRequest.mockResolvedValue({
        ok: true,
        data: { results: [] },
      });

      await queryDatabaseHandler({
        data_source_id: 'ds-123',
        page_size: 100,
        filter_properties: ['prop1', 'prop2'],
      });

      expect(mockNotionRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          queryParams: { filter_properties: ['prop1', 'prop2'] },
        }),
      );
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
