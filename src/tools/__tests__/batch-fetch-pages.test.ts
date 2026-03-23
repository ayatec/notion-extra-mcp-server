import { describe, it, expect, vi, beforeEach } from 'vitest';
import { batchFetchPagesHandler, batchFetchPagesSchema } from '../batch-fetch-pages.js';

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

const makePage = (id: string) => ({
  id,
  url: `https://www.notion.so/${id}`,
  created_time: '2026-01-01T00:00:00.000Z',
  properties: {
    名前: { id: 'title', type: 'title', title: [{ plain_text: `ページ ${id}` }] },
  },
});

describe('batch-fetch-pages', () => {
  describe('batchFetchPagesSchema', () => {
    it('必須パラメータのみでデフォルト値が適用される', () => {
      const result = batchFetchPagesSchema.parse({ page_ids: ['p1'] });
      expect(result.compact).toBe(false);
      expect(result.include_content).toBe(false);
    });

    it('page_ids が空配列でエラー', () => {
      expect(() => batchFetchPagesSchema.parse({ page_ids: [] })).toThrow();
    });

    it('page_ids が51件以上でエラー', () => {
      const ids = Array.from({ length: 51 }, (_, i) => `p${i}`);
      expect(() => batchFetchPagesSchema.parse({ page_ids: ids })).toThrow();
    });
  });

  describe('batchFetchPagesHandler', () => {
    it('複数ページを一括取得する', async () => {
      mockNotionRequest
        .mockResolvedValueOnce({ ok: true, data: makePage('p1') })
        .mockResolvedValueOnce({ ok: true, data: makePage('p2') });

      const result = await batchFetchPagesHandler({
        page_ids: ['p1', 'p2'],
        compact: false,
        include_content: false,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.results).toHaveLength(2);
      expect(parsed.results[0].id).toBe('p1');
      expect(parsed.results[1].id).toBe('p2');
      expect(parsed).not.toHaveProperty('errors');
    });

    it('compact: true でフラット化する', async () => {
      mockNotionRequest.mockResolvedValueOnce({ ok: true, data: makePage('p1') });

      const result = await batchFetchPagesHandler({
        page_ids: ['p1'],
        compact: true,
        include_content: false,
      });

      const parsed = JSON.parse(result.content[0].text);
      const page = parsed.results[0];
      expect(page.properties['名前']).toBe('ページ p1');
      expect(page).not.toHaveProperty('created_time');
    });

    it('include_content: true でページ本文を含む', async () => {
      mockNotionRequest
        .mockResolvedValueOnce({ ok: true, data: makePage('p1') })
        .mockResolvedValueOnce({ ok: true, data: { markdown: '# 見出し\n本文' } });

      const result = await batchFetchPagesHandler({
        page_ids: ['p1'],
        compact: false,
        include_content: true,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.results[0].content).toBe('# 見出し\n本文');
    });

    it('一部のページが失敗しても他は取得される', async () => {
      mockNotionRequest
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          code: 'object_not_found',
          message: 'Not found',
        })
        .mockResolvedValueOnce({ ok: true, data: makePage('p2') });

      const result = await batchFetchPagesHandler({
        page_ids: ['invalid', 'p2'],
        compact: false,
        include_content: false,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.results).toHaveLength(1);
      expect(parsed.results[0].id).toBe('p2');
      expect(parsed.errors).toHaveLength(1);
      expect(parsed.errors[0].page_id).toBe('invalid');
      // 部分的成功の場合は isError にならない（成功分のデータは有効）
      expect(result).not.toHaveProperty('isError');
    });
  });
});
