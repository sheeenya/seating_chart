# 座席管理システム - デプロイ手順

## 🚀 簡単デプロイ方法（推奨）

**ワンクリックでデプロイできます！**

```bash
npm run deploy
```

または、`deploy.bat` をダブルクリックしてください。

これで `deploy` フォルダに必要なファイルが自動的にコピーされます。

---

## 📋 手動デプロイ方法

### 1. 実行ファイル（exe）の作成

#### 必要なツールのインストール
```bash
npm install
```

#### 実行ファイルのビルド
```bash
npm run build
```

これで `dist` フォルダに `seating-chart-app.exe` が作成されます。

### 2. 専用PCでの配置

以下のファイルを専用PCにコピーしてください：

```
座席管理システム/
├── seating-chart-app.exe    # メインの実行ファイル
├── start-server.bat         # 起動用バッチファイル
├── public/                  # Webページのファイル
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   ├── layout.png
│   └── layout.svg
└── data/                    # データファイル（自動作成されます）
    ├── layout.json
    └── occupancy.json
```

---

## 3. 使用方法

1. `start-server.bat` をダブルクリックして起動
2. ブラウザで `http://localhost:8520` にアクセス
3. 座席管理システムが使用可能になります

---

## 4. 自動起動設定（オプション）

PCの起動時に自動でサーバーを開始したい場合：

1. `start-server.bat` のショートカットを作成
2. `Win + R` → `shell:startup` でスタートアップフォルダを開く
3. ショートカットをスタートアップフォルダに配置

---

---

## 5. データ保護とバックアップ

### 🛡️ 運用データの自動保護

デプロイ時に**運用中のレイアウトデータが上書きされることはありません**。

- **初回デプロイ時**: 開発環境の `data/layout.json` と `data/occupancy.json` がコピーされます
- **2回目以降**: 既存のデータファイルは保護され、上書きされません
- **テンプレート保存**: 新バージョンのレイアウトは `data/layout.template.json` として保存されます

### 📦 自動バックアップ

デプロイを実行すると、既存の運用データが自動的にバックアップされます：

```
deploy/
└── data/
    └── backup/
        └── 20260107_112030/    # 日時付きフォルダ
            ├── layout.json
            └── occupancy.json
```

バックアップは `deploy\data\backup\` フォルダに日時付きで保存されます。

### 🔄 データの復元方法

万が一、データを復元したい場合：

1. サーバーを停止する
2. `deploy\data\backup\` から該当する日時のフォルダを開く
3. バックアップファイルを `deploy\data\` にコピーして上書き
4. サーバーを再起動する

**例:**
```bash
# バックアップから復元
copy /Y deploy\data\backup\20260107_112030\layout.json deploy\data\layout.json
```

### 🔧 新バージョンのレイアウトを適用したい場合

開発環境で作成した新しいレイアウトを運用環境に適用したい場合：

1. デプロイ実行後、`deploy\data\layout.template.json` を確認
2. 必要に応じて手動で `layout.json` にリネーム（元のファイルは事前にバックアップ）

```bash
# 現在のレイアウトをバックアップ
copy deploy\data\layout.json deploy\data\layout.backup.json

# 新バージョンを適用
copy /Y deploy\data\layout.template.json deploy\data\layout.json
```

---

## 6. 注意事項

- 毎日朝4時に座席情報が自動リセットされます
- ファイアウォールの警告が出た場合は「アクセスを許可する」を選択してください
- ポート8520が他のアプリケーションで使用されていないことを確認してください