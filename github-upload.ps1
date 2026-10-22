# Run from ordinary PowerShell. GitHub authentication may be requested by Git.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$projectGitDirectory = Join-Path $PSScriptRoot '.git'
function Invoke-ProjectGit {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArguments)
    & git -C $PSScriptRoot --git-dir=$projectGitDirectory --work-tree=$PSScriptRoot @GitArguments
    if ($LASTEXITCODE -ne 0) { throw "Git command failed (exit $LASTEXITCODE). Upload stopped." }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is not installed or is not available in PATH.'
}
# Reinitialization preserves existing commits and repairs incomplete initialization.
# Explicit paths prevent a different working directory or GIT_DIR from selecting another repository.
Invoke-ProjectGit init
$repositoryReady = & git -C $PSScriptRoot --git-dir=$projectGitDirectory --work-tree=$PSScriptRoot rev-parse --is-inside-work-tree
if ($LASTEXITCODE -ne 0 -or $repositoryReady -ne 'true') {
    throw 'Repository initialization failed. Upload stopped before changing project files.'
}
Invoke-ProjectGit config --local user.name '김명현'
Invoke-ProjectGit config --local user.email 'myunghyun12@naver.com'
Invoke-ProjectGit add .
& git -C $PSScriptRoot --git-dir=$projectGitDirectory --work-tree=$PSScriptRoot diff --cached --quiet
$stagedExit = $LASTEXITCODE
if ($stagedExit -eq 1) {
    Invoke-ProjectGit commit -m 'feat: 요양 w4c 노트 초기 개발 작업 저장'
} elseif ($stagedExit -ne 0) {
    throw 'Could not inspect staged changes. Upload stopped.'
}
Invoke-ProjectGit branch -M main
$remoteNames = & git -C $PSScriptRoot --git-dir=$projectGitDirectory --work-tree=$PSScriptRoot remote
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect remotes. Upload stopped.' }
if ($remoteNames -contains 'origin') {
    Invoke-ProjectGit remote set-url origin 'https://github.com/nowbau-droid/-w4c-'
} else {
    Invoke-ProjectGit remote add origin 'https://github.com/nowbau-droid/-w4c-'
}
Invoke-ProjectGit push -u origin main
Write-Host 'Upload completed: https://github.com/nowbau-droid/-w4c-'
