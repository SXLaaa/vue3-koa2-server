$ErrorActionPreference = 'Stop'

function Stop-ListeningPort {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port,

    [Parameter(Mandatory = $true)]
    [string]$ServiceName
  )

  $processIds = @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  )

  if (-not $processIds.Count) {
    Write-Host "$ServiceName 未运行（端口 $Port 未监听）"
    return
  }

  foreach ($processId in $processIds) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
      Write-Host "已停止 $ServiceName：$($process.ProcessName)（PID $processId）"
    }
  }
}

Stop-ListeningPort -Port 3000 -ServiceName '业务后端和 Agent'

Get-Process -Name 'ollama app' -ErrorAction SilentlyContinue |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName -like 'ollama*' } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

$serverRunning = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
$ollamaRunning = Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName -like 'ollama*' }

if ($serverRunning -or $ollamaRunning) {
  throw '本地服务未完全关闭，请检查 3000 端口和 Ollama 进程'
}

Write-Host '业务后端、Agent 和 Ollama 已关闭。前端如仍在运行，请在前端终端按 Ctrl+C。'
