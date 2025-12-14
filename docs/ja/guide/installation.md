# インストール

## 前提条件

- [Bun](https://bun.sh) 1.3.4以降
- Claude Code CLIまたはMCP対応のClaude Desktop

## Claude MCPを使用したインストール

Todoriをインストールする最も簡単な方法は、Claude MCPレジストリを使用することです：

```bash
claude mcp add todori
```

このコマンドにより：
1. 最新版のTodoriがダウンロードされます
2. Claude設定にMCPサーバーとして構成されます
3. すべてのClaude Codeセッションで使用可能になります

## 手動インストール

手動でインストールする場合、または開発版を使用したい場合：

### 1. リポジトリのクローン

```bash
git clone https://github.com/litols/todori.git
cd todori
```

### 2. 依存関係のインストール

```bash
bun install
```

### 3. プロジェクトのビルド

```bash
bun run build:dist
```

### 4. MCPサーバーの設定

Claude設定ファイルにTodoriを追加：

**Claude Desktop (macOS)の場合：**

`~/Library/Application Support/Claude/claude_desktop_config.json`を編集：

```json
{
  "mcpServers": {
    "todori": {
      "command": "bun",
      "args": ["/path/to/todori/dist/server/index.js"]
    }
  }
}
```

**Claude Code CLIの場合：**

`~/.config/claude/config.json`を編集：

```json
{
  "mcpServers": {
    "todori": {
      "command": "bun",
      "args": ["/path/to/todori/dist/server/index.js"]
    }
  }
}
```

`/path/to/todori`をリポジトリをクローンした実際のパスに置き換えてください。

## 動作確認

インストール後、Todoriが正しく動作しているか確認：

1. 新しいClaude Codeセッションを開始
2. MCPサーバーが自動的に接続されます
3. タスクを作成してみる：

```
タスクを作成: ドキュメントを書く
```

タスクが正常に作成されれば、Todoriは正しく設定されています！

## 設定

### タスク保存場所

デフォルトでは、Todoriはプロジェクトディレクトリの`.todori/tasks.yaml`にタスクを保存します。この場所は最初のタスク作成時に自動的に作成されます。

### プロジェクト検出

Todoriは以下を探すことでプロジェクトルートを自動検出します：
- Gitリポジトリ（`.git`ディレクトリ）
- パッケージマネージャーファイル（`package.json`、`Cargo.toml`、`go.mod`など）

MCP設定でプロジェクトルートを手動で指定することもできます：

```json
{
  "mcpServers": {
    "todori": {
      "command": "bun",
      "args": ["/path/to/todori/dist/server/index.js"],
      "env": {
        "TODORI_PROJECT_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

## トラブルシューティング

### MCPサーバーが接続しない

1. Bunがインストールされているか確認: `bun --version`
2. 設定内のパスが正しいか確認
3. Claudeのログでエラーメッセージを確認

### タスクが永続化されない

1. プロジェクトディレクトリへの書き込み権限を確認
2. `.todori/`ディレクトリが作成可能か確認
3. 検出されたプロジェクトディレクトリ内にいるか確認

### 権限の問題

Unix系システムでは、サーバースクリプトが実行可能であることを確認：

```bash
chmod +x /path/to/todori/dist/server/index.js
```

## 次のステップ

- [Todoriの使い方を学ぶ](/ja/guide/usage)
- [APIリファレンスを見る](/ja/api/reference)
