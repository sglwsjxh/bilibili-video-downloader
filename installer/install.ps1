$ErrorActionPreference = "Stop"
$hostName = "com.sglwsjxh.bilibili_downloader"
$regPath = "HKCU:\SOFTWARE\Google\Chrome\NativeMessagingHosts\$hostName"

# --- 解析参数 ---
$HostPath = ""
$ExtensionId = ""
$Uninstall = $false

$i = 0
while ($i -lt $args.Count) {
  switch ($args[$i]) {
    '--ExtensionId' {
      $i++
      if ($i -lt $args.Count) { $ExtensionId = $args[$i] }
    }
    '--HostPath' {
      $i++
      if ($i -lt $args.Count) { $HostPath = $args[$i] }
    }
    '--Uninstall' {
      $Uninstall = $true
    }
  }
  $i++
}

# --- 卸载流程 ---
if ($Uninstall) {
  if (Test-Path $regPath) {
    Remove-Item -LiteralPath $regPath -Recurse -Force
    Write-Output "✅ Native Messaging Host 已卸载"
  } else {
    Write-Output "ℹ️  Native Messaging Host 未安装，跳过"
  }

  $oldRegPaths = @(
    "HKCR:\ffmpeg-run",
    "HKLM:\SOFTWARE\Classes\ffmpeg-run",
    "HKCU:\SOFTWARE\Classes\ffmpeg-run"
  )
  foreach ($p in $oldRegPaths) {
    if (Test-Path $p) {
      Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
      Write-Output "✅ 已清理旧注册表: $p"
    }
  }

  $oldFiles = @(
    "$PSScriptRoot\..\register.bat",
    "$PSScriptRoot\..\run-ffmpeg.vbs"
  )
  foreach ($f in $oldFiles) {
    if (Test-Path $f) {
      Remove-Item -LiteralPath $f -Force
      Write-Output "✅ 已删除旧文件: $f"
    }
  }

  return
}

# --- 安装流程 ---

# ExtensionId 必须提供
if (-not $ExtensionId) {
  Write-Error "❌ 必须指定扩展 ID (ExtensionId)"
  Write-Error "请从 chrome://extensions 页面复制扩展 ID 后重试"
  Write-Error "用法: .\install.ps1 --ExtensionId ""abcdefghijklmnopabcdefghijklmnop"""
  exit 1
}

# HostPath 默认指向 installer 下的预编译程序
if (-not $HostPath) {
  $scriptDir = Split-Path -Parent $PSScriptRoot
  $HostPath = Join-Path $scriptDir "installer\nativehost.exe"
}

if (-not (Test-Path $HostPath)) {
  Write-Error "❌ 找不到后端程序: $HostPath"
  Write-Error "请先编译 Go 后端: cd backend && go build -o ../installer/nativehost.exe ./cmd/nativehost/"
  exit 1
}

$HostPath = (Resolve-Path $HostPath).Path

$manifestPath = Join-Path $PSScriptRoot "$hostName.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$manifest.path = $HostPath
$manifest.allowed_origins = @("chrome-extension://$ExtensionId/")
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8

if (-not (Test-Path (Split-Path -Parent $regPath))) {
  New-Item -Path (Split-Path -Parent $regPath) -ItemType Directory -Force | Out-Null
}

New-Item -Path $regPath -Value $manifestPath -Force | Out-Null

Write-Output "✅ Native Messaging Host 安装成功！"
Write-Output "   主机程序: $HostPath"
Write-Output "   扩展 ID:  $ExtensionId"
Write-Output ""
Write-Output "📝 如果之后重新加载扩展导致 ID 变化，请重新运行此脚本"
