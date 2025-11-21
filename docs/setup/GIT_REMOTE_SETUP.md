# Git Remote設定

## 現在の設定
$(git remote -v)

## 環境別リモート
- **origin**: GitHubメインリポジトリ
  - URL: git@github-new:aisukoohiikudasai-sketch/oshicall.git
  - 使用: `git push origin main`

- **staging**: Heroku Staging環境 (oshicall-staging)
  - URL: https://git.heroku.com/oshicall-staging.git  
  - 使用: `git push staging main`

- **production**: Heroku Production環境 (oshicall-production)
  - URL: https://git.heroku.com/oshicall-production.git
  - 使用: `git push production main`
  - ステータス: ✅ 作成済み

## プッシュ方法
- **Stagingデプロイ**: `git push staging main`
- **Productionデプロイ**: `git push production main` 
- **GitHub同期**: `git push origin main`

## 注意事項
- Production環境が作成済みのため、全ての環境にpush可能です
- 各環境で適切な環境変数を設定してください

