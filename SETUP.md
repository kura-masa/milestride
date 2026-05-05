# Milestride セットアップ

## 1. Firebaseプロジェクト作成

1. <https://console.firebase.google.com/> にアクセス
2. **プロジェクトを追加** → 名前: `milestride`（任意） → Google Analyticsはオフでも可
3. 作成完了後、左上の **歯車アイコン → プロジェクトの設定**
4. **マイアプリ** セクションで **`</>` (Web)** アイコンをクリック
5. アプリのニックネーム: `milestride-web` → **アプリを登録**
6. 表示される `firebaseConfig` の6項目をコピー

## 2. `.env.local` を作成

`milestride-app/.env.local` に以下を記入：

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=milestride-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=milestride-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=milestride-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234...:web:abcd...
```

## 3. Authentication 有効化

1. 左メニュー **Authentication** → **始める**
2. **Sign-in method** タブ → **Google** を選択 → **有効にする**
3. プロジェクトのサポートメールを選択 → **保存**
4. **Settings → Authorized domains** に `localhost` があることを確認（デフォルトで入っている）。本番ドメインがあれば追加。

## 4. Firestore 有効化

1. 左メニュー **Firestore Database** → **データベースを作成**
2. **本番モードで開始** を選択（ルールは下で書く）
3. ロケーション: `asia-northeast1`（東京）推奨 → **有効化**

## 5. セキュリティルール適用

1. Firestore → **ルール** タブ
2. `firestore.rules` の中身をコピペ：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

3. **公開**

## 6. 起動

```bash
cd milestride-app
npm run dev
```

`http://localhost:3000` を開いて **Googleでサインイン**。スマホ実機で見るなら同一LANから `http://<PCのIP>:3000`。

## データ構造

```
users/{uid}/
  nodes/{nodeId}    title, phase, status, summary, detail,
                    groupId, parents[], order, checklist[],
                    createdAt, updatedAt
  groups/{groupId}  title, order, createdAt, updatedAt
```

- `parents[]` で任意のDAG接続（複数親OK）
- `groupId` でグループ（=本/案件/トピック）に所属
- `checklist[]` はノード内に配列で保存
