# 開発者向けガイド

このドキュメントは、ローカル開発・テスト・デバッグ時の実務手順をまとめたものです。

## 1. 開発環境
- Python 3.11+
- Node.js 18+
- npm
- Google Cloud プロジェクト（Firestore + OAuth 設定済み）
- ADC（`gcloud auth application-default login`）

## 2. 初期セットアップ

```bash
cp dotenv-example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm --prefix web install
```

## 3. 日常の起動

```bash
make run
```

- `web` を都度ビルドしてから API を起動します
- URL: `http://localhost:8000`

### バックエンドのみ起動
```bash
set -a; . ./.env; set +a
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### フロントのみ起動
```bash
npm --prefix web run dev
```

> 注意: 本番構成は同一オリジン前提です。`vite dev` 単体運用時は、必要に応じて Vite 側プロキシを追加してください。

## 4. テスト

```bash
pytest
```

既存テストは `app/tests/` にあり、取引更新時刻や親子アクセス制御などの回帰不具合を検知します。

## 5. 認証とセッション

- 通常: Google ID トークンを `/api/login` に渡して、独自セッションを取得
- 開発簡略化: `.env` に `DEV_USER_ID` を設定すると Bearer トークン検証をスキップ
- セッション有効期限: `SESSION_EXPIRE_DAYS`（既定 7 日）

## 6. 主要仕様ドキュメント
- UI仕様: `docs/UI_SPEC.md`
- 規約・親子仕様: `docs/TERMS_AND_FAMILY_SPEC.md`
- 全体像: `README.md`
