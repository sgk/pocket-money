# おこづかいノート

## これは何か
Googleログインで使える、家計の元帳（いれもの別の入出金・資金移動）アプリです。FastAPIとViteの構成で、起動するとブラウザから使えます。

## 必要な環境
- Node.js 18以上
- Python 3.11以上
- Google Cloud プロジェクト（Firestore利用）
- Google OAuth クライアントID（Web）
- Application Default Credentials（gcloudなどで認証）

## デプロイまでの手順（git clone から）
1. リポジトリを取得
   - `git clone <repo> && cd pocket-money`
2. GCPプロジェクトを作成・選択
   - `gcloud projects create <PROJECT_ID>`
   - `gcloud config set project <PROJECT_ID>`
3. 必要なAPIを有効化
   - `gcloud services enable firestore.googleapis.com run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com oauth2.googleapis.com`
4. Firestoreを作成（Native）
   - `gcloud firestore databases create --region=asia-northeast1`
5. ADCを準備
   - `gcloud auth application-default login`
6. OAuth同意画面と認証情報を設定
   - GCPコンソールで設定します
     - コンソール → APIとサービス → OAuth同意画面
     - ユーザータイプを選択（個人利用なら「外部」）
     - アプリ名・サポートメール・承認済みドメインを登録
     - 外部の場合はテストユーザーに自分のGoogleアカウントを追加
     - 保存して公開
   - 認証情報を作成
     - コンソール → APIとサービス → 認証情報 → 認証情報を作成 → OAuthクライアントID
     - アプリケーションの種類: ウェブアプリケーション
     - 承認済みのJavaScript生成元に以下を追加
       - `http://localhost:8000`
       - `https://<Cloud Runのドメイン>`
     - 作成されたクライアントIDを `GOOGLE_CLIENT_ID` に設定
     - 承認済みのリダイレクトURIに以下を追加
       - `http://localhost:8000/login`
       - `https://<Cloud Runのドメイン>/login`
7. 環境変数を用意
   - `cp dotenv-example .env`
   - `.env` に以下を設定
     - `GOOGLE_CLOUD_PROJECT`
     - `FIRESTORE_DATABASE="(default)"`
     - `GOOGLE_CLIENT_ID`
     - `SESSION_SECRET`（ランダムな文字列）
     - `SESSION_EXPIRE_DAYS`（未指定なら7）
     - `CLOUD_RUN_SERVICE`（例: `pocket-money`）
     - `CLOUD_RUN_REGION`（例: `asia-northeast1`）
8. Cloud Build用の権限を付与（最初の1回だけ）
   - `PROJECT_NUMBER=$(gcloud projects describe "$GOOGLE_CLOUD_PROJECT" --format="value(projectNumber)")`
   - `gcloud projects add-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role="roles/storage.admin"`
   - `gcloud projects add-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role="roles/cloudbuild.builds.builder"`
9. デプロイ
   - `make deploy`
   - Cloud BuildでDockerfileを使ってビルドされます（ローカルビルド不要）
10. ブラウザで開く
   - `https://<サービスURL>/`

## ローカルで動かす
1. 依存関係をインストール
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r requirements.txt`
2. 起動
   - `make run`
3. ブラウザで開く
   - `http://localhost:8000/`
4. Googleログインして使う
   - ログインは7日間有効（`SESSION_EXPIRE_DAYS`で変更）
   - 7日間の有効期限を実現するため、サーバーが独自セッションを発行します
     - その署名鍵として `SESSION_SECRET` が必要です
