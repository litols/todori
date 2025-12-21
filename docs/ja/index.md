---
layout: home

hero:
  name: Todori
  text: Claude Code専用タスク管理
  tagline: 最小限のコンテキストオーバーヘッドで永続化された構造的タスク管理を実現するMCPサーバー
  actions:
    - theme: brand
      text: はじめる
      link: /ja/guide/installation
    - theme: alt
      text: GitHub で見る
      link: https://github.com/litols/todori

features:
  - icon: 🎯
    title: Claude Code統合優先設計
    details: 直接的なAPI呼び出しではなく、Claude Codeのコンテキスト理解を活用したAI駆動のタスク展開
  - icon: 📦
    title: 最小限のコンテキスト
    details: MCPレスポンスは平均2KB未満を目標とし、Claude Codeのコンテキストウィンドウを保護
  - icon: 📝
    title: YAML形式のストレージ
    details: 人間が読みやすく、git差分の可視性が高く、コメント対応のYAMLファイル
  - icon: ⚡
    title: 依存関係ゼロ
    details: データベース依存なし、Bunランタイムで最大のパフォーマンスを実現
---

## Todoriとは？

**Todori**は、Claude Code専用に設計されたModel Context Protocol (MCP)サーバーで、貴重なコンテキストウィンドウを消費することなく、永続化された構造的タスク管理を提供します。

従来のタスク管理ツールとは異なり、TodoriはAI駆動のワークフローに最適化されています：

- **コンテキスト認識**: Claude Codeのプロジェクト理解を活用
- **軽量**: MCPレスポンスのオーバーヘッドを最小化
- **Git親和性**: バージョン管理と相性の良いYAMLベースのストレージ
- **高速**: 外部データベース依存なしのBunランタイム

## クイックスタート

MCPサーバーとしてTodoriをインストール：

```bash
claude mcp add todori -- npx -y @litols/todori
```

その後、Claude Codeセッションで使用開始：
- セッション間でタスクを追跡
- タスク間の依存関係を管理
- 複雑なタスクを自動的にサブタスクに展開
- 効率的にタスクをクエリ・フィルタリング

[はじめる →](/ja/guide/installation)
