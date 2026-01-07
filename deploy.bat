@echo off
chcp 65001 >nul
echo ========================================
echo 座席管理システム - デプロイスクリプト
echo ========================================
echo.

echo [1/4] 依存関係のインストールを確認...
if not exist "node_modules\" (
    echo npmパッケージをインストールしています...
    call npm install
    if errorlevel 1 (
        echo エラー: npm install に失敗しました
        pause
        exit /b 1
    )
) else (
    echo 依存関係は既にインストール済みです
)
echo.

echo [2/4] 実行ファイルをビルドしています...
call npm run build
if errorlevel 1 (
    echo エラー: ビルドに失敗しました
    pause
    exit /b 1
)
echo ビルド完了
echo.

echo [3/4] デプロイフォルダにファイルをコピーしています...

REM deployフォルダが存在しない場合は作成
if not exist "deploy\" mkdir deploy
if not exist "deploy\public\" mkdir deploy\public

REM exeファイルをコピー
if exist "dist\seating-chart-app.exe" (
    copy /Y "dist\seating-chart-app.exe" "deploy\seating-chart-app.exe" >nul
    echo   - seating-chart-app.exe をコピーしました
) else (
    echo 警告: dist\seating-chart-app.exe が見つかりません
)

REM publicフォルダをコピー
if exist "public\" (
    xcopy /E /Y /I /Q "public\*" "deploy\public\" >nul
    echo   - publicフォルダをコピーしました
)

REM start-server.batをコピー
if exist "start-server.bat" (
    copy /Y "start-server.bat" "deploy\start-server.bat" >nul
    echo   - start-server.bat をコピーしました
)

REM 使用方法.mdをコピー（存在する場合）
if exist "deploy\使用方法.md" (
    echo   - 使用方法.md は既に存在します
) else (
    if exist "README-deployment.md" (
        copy /Y "README-deployment.md" "deploy\使用方法.md" >nul
        echo   - 使用方法.md を作成しました
    )
)


echo.

echo [4/4] デプロイ完了！
echo.
echo ========================================
echo デプロイ先: deploy\ フォルダ
echo ========================================
echo.
echo 重要: dataフォルダは含まれていません
echo サーバー側の運用データは保護されます
echo.
echo 次のステップ:
echo 1. deploy\ フォルダを専用PCにコピー（上書き可）
echo 2. deploy\start-server.bat をダブルクリックして起動
echo 3. 初回起動時に data フォルダが自動作成されます
echo 4. ブラウザで http://localhost:8520 にアクセス
echo.
pause

