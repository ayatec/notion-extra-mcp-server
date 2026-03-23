import { describe, it, expect } from 'vitest';
import { resolvePropertyIds } from '../schema.js';

describe('schema', () => {
  describe('resolvePropertyIds', () => {
    const map = {
      名前: 'title',
      ステータス: 'KmcG',
      タグ: 'fBso',
      数値: 'lYUT',
    };

    it('プロパティ名をIDに変換する', () => {
      const result = resolvePropertyIds(['名前', 'ステータス'], map);
      expect(result).toEqual(['title', 'KmcG']);
    });

    it('すでにIDの場合はそのまま通す', () => {
      const result = resolvePropertyIds(['title', 'KmcG'], map);
      expect(result).toEqual(['title', 'KmcG']);
    });

    it('名前とIDを混在で指定できる', () => {
      const result = resolvePropertyIds(['名前', 'KmcG', 'タグ'], map);
      expect(result).toEqual(['title', 'KmcG', 'fBso']);
    });

    it('マッピングに存在しない値はそのまま通す', () => {
      const result = resolvePropertyIds(['存在しないプロパティ'], map);
      expect(result).toEqual(['存在しないプロパティ']);
    });
  });
});
