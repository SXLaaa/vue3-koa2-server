$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$ollamaCommand = Get-Command ollama -ErrorAction SilentlyContinue
$ollamaPath = if ($ollamaCommand) {
  $ollamaCommand.Source
} else {
  Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
}

if (-not (Test-Path -LiteralPath $ollamaPath)) {
  throw '未找到 Ollama，请先安装：https://ollama.com/download/windows'
}

try {
  Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 | Out-Null
} catch {
  Start-Process -FilePath $ollamaPath -ArgumentList 'serve' -WindowStyle Hidden
  for ($attempt = 0; $attempt -lt 15; $attempt += 1) {
    Start-Sleep -Seconds 1
    try {
      Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 | Out-Null
      break
    } catch {
      if ($attempt -eq 14) {
        throw 'Ollama 已启动，但本地 API 在 15 秒内没有响应'
      }
    }
  }
}

$model = if ($env:AGENT_MODEL) { $env:AGENT_MODEL } else { 'qwen2.5-coder:7b' }
$models = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5
if (-not ($models.models | Where-Object { $_.name -eq $model })) {
  Write-Warning "未安装模型 $model，请先执行：ollama pull $model"
}

Set-Location -LiteralPath $projectRoot
$env:MONGO_DISABLED = '1'
& node bin/www
