import { describe, it, expect, vi, beforeEach } from 'vitest';
import { batchUpdatePagesHandler, batchUpdatePagesSchema } from '../batch-update-pages.js';

vi.mock('../../lib/notion-client.js', () => ({
  notionRequest: vi.fn(),
}));

// RateLimiter を即座に通過するモックに置換
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

describe('batch-update-pages', () => {
  describe('batchUpdatePagesSchema', () => {
    it('updates 配列を正しくパースする', () => {
      const result = batchUpdatePagesSchema.parse({
        updates: [{ page_id: 'p1', properties: { Name: { title: [] } } }],
      });
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].page_id).toBe('p1');
    });

    it('空配列でエラー', () => {
      expect(() => batchUpdatePagesSchema.parse({ updates: [] })).toThrow();
    });

    it('51件以上でエラー', () => {
      const updates = Array.from({ length: 51 }, (_, i) => ({
        page_id: `p${i}`,
        properties: {},
      }));
      expect(() => batchUpdatePagesSchema.parse({ updates })).toThrow();
    });
  });

  describe('batchUpdatePagesHandler', () => {
    it('全成功時にサマリーを返す', async () => {
      mockNotionRequest.mockResolvedValue({ ok: true, data: {} });

      const result = await batchUpdatePagesHandler({
        updates: [
          { page_id: 'p1', properties: { Name: { title: [] } } },
          { page_id: 'p2', properties: { Name: { title: [] } } },
        ],
      });

      const summary = JSON.parse(result.content[0].text);
      expect(summary.total).toBe(2);
      expect(summary.succeeded).toBe(2);
      expect(summary.failed).toBe(0);
      expect(result).not.toHaveProperty('isError');
    });

    it('部分失敗時に isError: true を返す', async () => {
      mockNotionRequest.mockResolvedValueOnce({ ok: true, data: {} }).mockResolvedValueOnce({
        ok: false,
        status: 404,
        code: 'object_not_found',
        message: 'Page not found',
      });

      const result = await batchUpdatePagesHandler({
        updates: [
          { page_id: 'p1', properties: {} },
          { page_id: 'p2', properties: {} },
        ],
      });

      const summary = JSON.parse(result.content[0].text);
      expect(summary.total).toBe(2);
      expect(summary.succeeded).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.results[1].error).toContain('object_not_found');
      expect(result).toHaveProperty('isError', true);
    });

    it('全失敗時に isError: true を返す', async () => {
      mockNotionRequest.mockResolvedValue({
        ok: false,
        status: 500,
        code: 'internal_server_error',
        message: 'Server error',
      });

      const result = await batchUpdatePagesHandler({
        updates: [
          { page_id: 'p1', properties: {} },
          { page_id: 'p2', properties: {} },
        ],
      });

      const summary = JSON.parse(result.content[0].text);
      expect(summary.total).toBe(2);
      expect(summary.succeeded).toBe(0);
      expect(summary.failed).toBe(2);
      expect(result).toHaveProperty('isError', true);
    });

    it('各ページに正しいリクエストを送信する', async () => {
      mockNotionRequest.mockResolvedValue({ ok: true, data: {} });

      await batchUpdatePagesHandler({
        updates: [
          { page_id: 'p1', properties: { Status: { select: { name: 'Done' } } } },
          { page_id: 'p2', properties: { Priority: { number: 1 } } },
        ],
      });

      expect(mockNotionRequest).toHaveBeenCalledTimes(2);
      expect(mockNotionRequest).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/pages/p1',
        body: { properties: { Status: { select: { name: 'Done' } } } },
      });
      expect(mockNotionRequest).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/pages/p2',
        body: { properties: { Priority: { number: 1 } } },
      });
    });
  });
});
