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
  - 使用: `git push production main` (アプリ作成後)
  - ステータス: 準備中

## プッシュ方法
- **Stagingデプロイ**: `git push staging main`
- **Productionデプロイ**: `git push production main` (準備完了後)
- **GitHub同期**: `git push origin main`

## 注意事項
- Production環境はまだ作成されていないため、pushするとエラーになります
- Herokuアプリ作成後、自動的にpushできるようになります

