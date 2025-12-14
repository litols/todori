# APIリファレンス

Todoriはタスク管理のためのMCPツールを公開しています。MCPサーバーが実行されている場合、これらのツールはClaude Codeで自動的に利用可能になります。

## タスク管理ツール

### `create_task`

現在のプロジェクトに新しいタスクを作成します。

**パラメータ:**
- `title` (string, 必須): タスクタイトル
- `description` (string, オプション): 詳細なタスク説明
- `priority` (number, オプション): 優先度レベル（0-100）、デフォルト: 50
- `dependencies` (string[], オプション): このタスクが依存するタスクIDの配列
- `status` (string, オプション): 初期ステータス、デフォルト: "pending"

**戻り値:**
```typescript
{
  id: string;
  title: string;
  status: TaskStatus;
  created: ISO8601;
}
```

**例:**
```typescript
{
  "title": "ユーザー認証を実装",
  "description": "JWTベースの認証システムを追加",
  "priority": 80,
  "status": "pending"
}
```

---

### `list_tasks`

現在のプロジェクトのすべてのタスクを一覧表示します。

**パラメータ:**
- `status` (string, オプション): ステータスでフィルタ
- `minPriority` (number, オプション): 最小優先度閾値
- `maxPriority` (number, オプション): 最大優先度閾値

**戻り値:**
```typescript
{
  tasks: Task[];
  count: number;
}
```

**例:**
```typescript
{
  "status": "pending",
  "minPriority": 70
}
```

---

### `get_task`

IDで特定のタスクを取得します。

**パラメータ:**
- `id` (string, 必須): タスクID

**戻り値:**
```typescript
{
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;
  dependencies: string[];
  subtasks: Subtask[];
  metadata: {
    created: ISO8601;
    updated: ISO8601;
    completedAt?: ISO8601;
  };
}
```

---

### `update_task`

既存のタスクを更新します。

**パラメータ:**
- `id` (string, 必須): タスクID
- `title` (string, オプション): 新しいタイトル
- `description` (string, オプション): 新しい説明
- `status` (TaskStatus, オプション): 新しいステータス
- `priority` (number, オプション): 新しい優先度

**戻り値:**
```typescript
{
  id: string;
  updated: ISO8601;
}
```

**例:**
```typescript
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "in-progress",
  "priority": 90
}
```

---

### `delete_task`

タスクを完全に削除します。

**パラメータ:**
- `id` (string, 必須): タスクID

**戻り値:**
```typescript
{
  success: boolean;
  deletedId: string;
}
```

---

### `add_dependency`

タスク間に依存関係を追加します。

**パラメータ:**
- `taskId` (string, 必須): 他のタスクに依存するタスク
- `dependsOn` (string, 必須): 先に完了する必要があるタスクID

**戻り値:**
```typescript
{
  success: boolean;
  taskId: string;
  dependencies: string[];
}
```

**注意:** 循環依存を自動的に検証します。

---

### `remove_dependency`

依存関係を削除します。

**パラメータ:**
- `taskId` (string, 必須): タスクID
- `dependencyId` (string, 必須): 削除する依存関係

**戻り値:**
```typescript
{
  success: boolean;
  taskId: string;
  dependencies: string[];
}
```

---

## サブタスク管理

### `add_subtask`

既存のタスクにサブタスクを追加します。

**パラメータ:**
- `taskId` (string, 必須): 親タスクID
- `title` (string, 必須): サブタスクタイトル
- `description` (string, オプション): サブタスク説明

**戻り値:**
```typescript
{
  taskId: string;
  subtaskId: string;
  title: string;
}
```

---

### `complete_subtask`

サブタスクを完了としてマークします。

**パラメータ:**
- `taskId` (string, 必須): 親タスクID
- `subtaskId` (string, 必須): サブタスクID

**戻り値:**
```typescript
{
  success: boolean;
  taskId: string;
  subtaskId: string;
}
```

---

## タスク展開

### `expand_task`

Claude Codeのコンテキスト理解を使用してタスクをサブタスクに展開します。

**パラメータ:**
- `taskId` (string, 必須): 展開するタスク
- `context` (string, オプション): 展開のための追加コンテキスト

**戻り値:**
```typescript
{
  taskId: string;
  subtasks: Subtask[];
  expandedAt: ISO8601;
}
```

**注意:** このツールはClaude Codeがプロジェクトを分析してサブタスクを提案するためのプロンプトを生成します。提案は解析されてサブタスクとして追加されます。

---

## クエリツール

### `query_tasks`

フィルタとソートを使用した高度なタスククエリ。

**パラメータ:**
- `filter` (object, オプション): フィルタ条件
  - `status` (string | string[]): ステータスフィルタ
  - `priority` (object): 優先度範囲
    - `min` (number): 最小優先度
    - `max` (number): 最大優先度
  - `search` (string): タイトルと説明で検索
- `sort` (object, オプション): ソート設定
  - `field` (string): ソートするフィールド（priority、created、updated）
  - `order` ("asc" | "desc"): ソート順

**戻り値:**
```typescript
{
  tasks: Task[];
  count: number;
  filters: object;
}
```

**例:**
```typescript
{
  "filter": {
    "status": ["pending", "in-progress"],
    "priority": { "min": 70 },
    "search": "認証"
  },
  "sort": {
    "field": "priority",
    "order": "desc"
  }
}
```

---

## データ型

### TaskStatus

```typescript
type TaskStatus =
  | "pending"
  | "in-progress"
  | "blocked"
  | "done"
  | "deferred"
  | "cancelled";
```

### Task

```typescript
interface Task {
  id: string;                    // UUID
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;              // 0-100
  dependencies: string[];        // タスクID
  subtasks: Subtask[];
  metadata: {
    created: ISO8601;
    updated: ISO8601;
    completedAt?: ISO8601;
  };
}
```

### Subtask

```typescript
interface Subtask {
  id: string;                    // UUID
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: ISO8601;
}
```

---

## ストレージ形式

タスクは人間が読みやすいYAML形式で`.todori/tasks.yaml`に保存されます：

```yaml
tasks:
  - id: 550e8400-e29b-41d4-a716-446655440000
    title: ユーザー認証を実装
    description: JWTベースの認証システムを追加
    status: in-progress
    priority: 80
    dependencies: []
    subtasks:
      - id: 6ba7b810-9dad-11d1-80b4-00c04fd430c8
        title: ユーザーモデルを作成
        completed: true
        completedAt: 2025-12-14T10:30:00Z
      - id: 6ba7b811-9dad-11d1-80b4-00c04fd430c8
        title: JWTミドルウェアをセットアップ
        completed: false
    metadata:
      created: 2025-12-14T09:00:00Z
      updated: 2025-12-14T10:30:00Z
```

---

## エラーハンドリング

すべてのツールは一貫した形式でエラーを返します：

```typescript
{
  error: string;
  code: string;
  details?: object;
}
```

### 一般的なエラーコード

- `TASK_NOT_FOUND`: タスクIDが存在しない
- `CIRCULAR_DEPENDENCY`: 依存関係の追加により循環が発生する
- `INVALID_STATUS`: 無効なステータス値
- `INVALID_PRIORITY`: 優先度が範囲外（0-100）
- `STORAGE_ERROR`: ファイルシステムエラー
- `VALIDATION_ERROR`: 入力検証失敗

---

## コンテキストウィンドウ最適化

Todoriはコンテキストウィンドウ使用量を最小限にするように設計されています：

- **平均レスポンスサイズ**: ツール呼び出しあたり2KB未満
- **一覧操作**: デフォルトで最小限のタスク要約を返す
- **展開プロンプト**: Claude Codeを効率的にガイドするよう構造化
- **ストレージ形式**: 一貫性のためのアトミック書き込みを伴うYAML

---

## パフォーマンス特性

- **タスク作成**: O(1)
- **タスク検索**: IDでO(1)
- **タスク一覧**: O(n)、nはタスク数
- **依存関係検証**: 循環検出でO(n)
- **ファイルI/O**: 一貫性のためproper-lockfileを使用したアトミック書き込み

---

## 統合例

以下の例については[examplesディレクトリ](https://github.com/litols/todori/tree/main/examples)を参照：
- CI/CDパイプラインとの統合
- カスタムワークフロー自動化
- プロジェクトテンプレート
- 高度なクエリパターン
