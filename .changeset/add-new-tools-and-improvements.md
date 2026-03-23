---
'@ayatec/notion-extra-mcp-server': minor
---

新規ツール4種追加と既存ツールの大幅改善

**新規ツール:**

- `find-by-unique-id`: unique_id（自動採番ID）でページを1件検索。compact/include_content対応
- `modify-relation`: リレーションプロパティの追加・削除。既存値を保持した差分更新
- `append-content`: Markdown APIでページ末尾にコンテンツを追記
- `batch-fetch-pages`: 複数ページの詳細を一括取得（最大50件）。compact/include_content対応

**既存ツール改善:**

- `query-database`: compact モード（レスポンス約1/10に圧縮）、output_mode: "count"（件数のみ取得）、filter_propertiesのプロパティ名指定対応
- 全ツール: description/パラメータ説明を英語化しトークン効率改善、エラーメッセージにステータスコード別ガイダンス追加
- `batch-update-pages`/`batch-fetch-pages`: 部分的成功時はisErrorを返さないよう改善
