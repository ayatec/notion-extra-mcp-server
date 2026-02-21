import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDataSourceSchemaHandler,
  getDataSourceSchemaSchema,
} from '../get-data-source-schema.js';

vi.mock('../../lib/notion-client.js', () => ({
  notionRequest: vi.fn(),
}));

import { notionRequest } from '../../lib/notion-client.js';

const mockNotionRequest = vi.mocked(notionRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('get-data-source-schema', () => {
  describe('getDataSourceSchemaSchema', () => {
    it('data_source_id を正しくパースする', () => {
      const result = getDataSourceSchemaSchema.parse({ data_source_id: 'ds-abc' });
      expect(result.data_source_id).toBe('ds-abc');
    });

    it('data_source_id が空文字でエラー', () => {
      expect(() => getDataSourceSchemaSchema.parse({ data_source_id: '' })).toThrow();
    });
  });

  describe('getDataSourceSchemaHandler', () => {
    it('成功レスポンスを返す', async () => {
      const schema = {
        object: 'data_source',
        id: 'ds-abc',
        properties: { Name: { type: 'title' } },
      };
      mockNotionRequest.mockResolvedValue({ ok: true, data: schema });

      const result = await getDataSourceSchemaHandler({ data_source_id: 'ds-abc' });

      expect(JSON.parse(result.content[0].text)).toEqual(schema);
      expect(result).not.toHaveProperty('isError');
      expect(mockNotionRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/data_sources/ds-abc',
      });
    });

    it('APIエラー時に isError: true を返す', async () => {
      mockNotionRequest.mockResolvedValue({
        ok: false,
        status: 404,
        code: 'object_not_found',
        message: 'Data source not found',
      });

      const result = await getDataSourceSchemaHandler({ data_source_id: 'ds-xxx' });

      expect(result.content[0].text).toContain('object_not_found');
      expect(result).toHaveProperty('isError', true);
    });
  });
});
