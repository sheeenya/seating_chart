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
if not exist "deploy\data\" mkdir deploy\data

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

REM ========================================
REM 運用データのバックアップを作成
REM ========================================
if exist "deploy\data\" (
    echo.
    echo 運用データをバックアップしています...
    
    REM バックアップフォルダを作成（日時付き）
    set BACKUP_TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
    set BACKUP_TIMESTAMP=%BACKUP_TIMESTAMP: =0%
    set BACKUP_DIR=deploy\data\backup\%BACKUP_TIMESTAMP%
    
    if not exist "deploy\data\backup\" mkdir "deploy\data\backup"
    mkdir "%BACKUP_DIR%" >nul 2>&1
    
    REM 既存のデータファイルをバックアップ
    if exist "deploy\data\layout.json" (
        copy /Y "deploy\data\layout.json" "%BACKUP_DIR%\layout.json" >nul
        echo   - layout.json をバックアップしました
    )
    if exist "deploy\data\occupancy.json" (
        copy /Y "deploy\data\occupancy.json" "%BACKUP_DIR%\occupancy.json" >nul
        echo   - occupancy.json をバックアップしました
    )
    echo   バックアップ先: %BACKUP_DIR%
    echo.
)

REM ========================================
REM データファイルの保護（既存ファイルは絶対に上書きしない）
REM ========================================
if exist "data\" (
    REM 運用データが存在する場合は保護
    if not exist "deploy\data\layout.json" (
        if exist "data\layout.json" (
            copy /Y "data\layout.json" "deploy\data\layout.json" >nul
            echo   - data\layout.json をコピーしました（初回デプロイ）
        )
    ) else (
        echo   - data\layout.json は既に存在します（運用データ保護のためスキップ）
    )
    
    if not exist "deploy\data\occupancy.json" (
        if exist "data\occupancy.json" (
            copy /Y "data\occupancy.json" "deploy\data\occupancy.json" >nul
            echo   - data\occupancy.json をコピーしました（初回デプロイ）
        )
    ) else (
        echo   - data\occupancy.json は既に存在します（運用データ保護のためスキップ）
    )
    
    REM 新バージョンのレイアウトをテンプレートとして保存
    if exist "data\layout.json" (
        copy /Y "data\layout.json" "deploy\data\layout.template.json" >nul
        echo   - 新バージョンのレイアウトテンプレートを保存しました
        echo     （必要に応じて layout.template.json を参照してください）
    )
)

echo.

echo [4/4] デプロイ完了！
echo.
echo ========================================
echo デプロイ先: deploy\ フォルダ
echo ========================================
echo.
echo 次のステップ:
echo 1. deploy\ フォルダを専用PCにコピー
echo 2. deploy\start-server.bat をダブルクリックして起動
echo 3. ブラウザで http://localhost:8520 にアクセス
echo.
pause

