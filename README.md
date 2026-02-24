# おこづかいノート

## これは何か
おこづかいノートは、**親子で使う前提**の「おこづかい帳 / 家計元帳」アプリです。

- Google ログインで利用します
- 資産（財布・口座など）ごとの残高管理ができます
- 支出 / 収入 / 振替を 1 つの元帳で管理できます
- 親アカウントが子どもアカウントを切り替えて閲覧できます（`X-Child-Id` ヘッダー）
- 利用規約同意と年齢区分（大人 / 子ども）に応じて利用可否を制御します

構成は **FastAPI（API + 静的配信）** と **React + Vite（SPA）** です。フロントはビルド成果物を FastAPI から配信します。

---

## 動作環境

### 必須
- Python 3.11 以上（Docker では 3.12）
- Node.js 18 以上
- npm
- Google Cloud プロジェクト
- Firestore（Native モード）
- Google OAuth クライアント ID（Web）
- Application Default Credentials（`gcloud auth application-default login`）

### 開発で利用する主なツール
- `uvicorn`（FastAPI 起動）
- `pytest`（バックエンドテスト）
- `vite`（フロント開発 / ビルド）

---

## インストールとローカル起動

### 1. リポジトリ取得
```bash
git clone <repo>
cd pocket-money
```

### 2. 環境変数ファイル作成
```bash
cp dotenv-example .env
```

`app/core/config.py` で読み込まれる主要変数:

| 変数名 | 必須 | 説明 |
|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | 任意（本番では必須） | Firestore クライアントのプロジェクト ID |
| `FIRESTORE_DATABASE` | 任意 | Firestore DB 名（通常 `(default)`） |
| `GOOGLE_CLIENT_ID` | 必須 | Google ログインの OAuth クライアント ID |
| `SESSION_SECRET` | 必須 | サーバー署名セッショントークンの署名鍵 |
| `SESSION_EXPIRE_DAYS` | 任意 | セッション有効日数（既定 7） |
| `DEV_USER_ID` | 任意 | 開発時の認証スキップ用ユーザー ID |
| `CLOUD_RUN_SERVICE` | デプロイ時必須 | Cloud Run サービス名 |
| `CLOUD_RUN_REGION` | デプロイ時必須 | Cloud Run リージョン |

### 3. 依存関係インストール
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm --prefix web install
```

### 4. 起動
```bash
make run
```

- `make run` は先に `web` をビルドしてから FastAPI を起動します
- アクセス先: `http://localhost:8000`

---

## デプロイ（Cloud Run）

`.env` を設定したうえで次を実行します。

```bash
make deploy
```

`make deploy` は `gcloud run deploy --source .` を使うため、Cloud Build 側で Dockerfile に基づきビルドされます。

---

## アプリ内部構造

## 全体像

```text
[Browser]
  └─ React SPA (web/src)
       └─ fetch /api/*
            ↓
        FastAPI (app/main.py)
            ├─ app/api/routes_*.py   # エンドポイント
            ├─ app/services/*.py     # 業務ロジック
            ├─ app/core/*.py         # 認証・設定・Firestore・規約
            └─ Firestore
```

### ディレクトリ構成（主要部分）

```text
app/
  api/         ルーティング層（HTTP 入出力）
  services/    ドメインロジック（取引・オンボーディング等）
  core/        共通基盤（認証・設定・Firestore・エラー）
  models/      Pydantic モデル
  tests/       pytest テスト
web/
  src/components/ 画面コンポーネント
  src/lib/        API クライアント・ユーティリティ・文言
  src/pages/      画面単位のページ
docs/
  UI_SPEC.md
  TERMS_AND_FAMILY_SPEC.md
```

### バックエンドの責務分離
- `routes_*`: バリデーションとレスポンス整形
- `services/*`: Firestore 更新と業務ルール
- `core/auth.py`: Google ID トークン検証 + 独自セッショントークン発行/検証
- `core/terms.py`: 規約スナップショット解決、再同意期限評価
- `api/deps.py`: 利用可能状態（規約同意、親子アクセス権）の共通チェック

### フロントエンドの要点
- `web/src/lib/api.ts` が API 通信を集約
- 認証トークンは `localStorage`（`auth.token`）に保存
- 取引一覧は `Last-Modified` / `If-Modified-Since` + ローカルキャッシュで 304 を活用
- 画面ルーティングは `web/src/routes.tsx`

---

## Firestore データ構造（概略）

- `users/{uid}`: プロフィール、規約同意、親子関連、更新時刻
- `users/{uid}/assets/*`: 資産
- `users/{uid}/categories/*`: 費目
- `users/{uid}/transactions/*`: 取引
- `users/{uid}/balanceSnapshots/*`: 月次集計キャッシュ
- `invites/*`: 親子招待
- `terms/*`: 規約定義
- `errorLogs/*`: エラーログ

親子関係は新旧形式を併用しています。

- 旧: `parent`, `parentUid`
- 新: `parents[]`, `parentUids[]`

---

## API エンドポイント（主要）

- 認証: `/api/login`, `/api/auth/me`
- 設定: `/api/config`
- 初期データ: `/api/bootstrap`
- 資産: `/api/assets`, `/api/assets/{asset_id}`
- 費目: `/api/categories`, `/api/categories/{category_id}`
- 取引: `/api/transactions/*`（一覧 / 作成 / 更新 / 削除 / export / import / 全削除）
- サマリー: `/api/summary/monthly`
- 招待: `/api/invites/*`
- オンボーディング: `/api/onboarding/*`

ヘルスチェック: `/healthz`

---

## 開発時チェック

```bash
pytest
npm --prefix web run build
```

必要に応じて `README_DEV.md` も参照してください。
