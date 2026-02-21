import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateDataSourceSchemaHandler,
  updateDataSourceSchemaSchema,
} from '../update-data-source-schema.js';

vi.mock('../../lib/notion-client.js', () => ({
  notionRequest: vi.fn(),
}));

import { notionRequest } from '../../lib/notion-client.js';

const mockNotionRequest = vi.mocked(notionRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('update-data-source-schema', () => {
  describe('updateDataSourceSchemaSchema', () => {
    it('data_source_id と properties を正しくパースする', () => {
      const result = updateDataSourceSchemaSchema.parse({
        data_source_id: 'ds-123',
        properties: { NewProp: { rich_text: {} } },
      });
      expect(result.data_source_id).toBe('ds-123');
      expect(result.properties).toEqual({ NewProp: { rich_text: {} } });
    });

    it('data_source_id が空文字でエラー', () => {
      expect(() =>
        updateDataSourceSchemaSchema.parse({ data_source_id: '', properties: {} }),
      ).toThrow();
    });

    it('properties が未指定でエラー', () => {
      expect(() => updateDataSourceSchemaSchema.parse({ data_source_id: 'ds-123' })).toThrow();
    });
  });

  describe('updateDataSourceSchemaHandler', () => {
    it('成功レスポンスを返す', async () => {
      const updated = { object: 'data_source', id: 'ds-123', properties: {} };
      mockNotionRequest.mockResolvedValue({ ok: true, data: updated });

      const result = await updateDataSourceSchemaHandler({
        data_source_id: 'ds-123',
        properties: { NewProp: { rich_text: {} } },
      });

      expect(JSON.parse(result.content[0].text)).toEqual(updated);
      expect(result).not.toHaveProperty('isError');
      // Data Sources APIのパスを使用していることを確認
      expect(mockNotionRequest).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/data_sources/ds-123',
        body: { properties: { NewProp: { rich_text: {} } } },
      });
    });

    it('APIエラー時に isError: true を返す', async () => {
      mockNotionRequest.mockResolvedValue({
        ok: false,
        status: 400,
        code: 'validation_error',
        message: 'Cannot update status property',
      });

      const result = await updateDataSourceSchemaHandler({
        data_source_id: 'ds-123',
        properties: { Status: { name: 'NewName' } },
      });

      expect(result.content[0].text).toContain('validation_error');
      expect(result).toHaveProperty('isError', true);
    });
  });
});
