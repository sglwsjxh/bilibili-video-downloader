$ErrorActionPreference = "Stop"
$hostName = "com.sglwsjxh.bilibili_downloader"
$chromeRegPath = "HKCU:\SOFTWARE\Google\Chrome\NativeMessagingHosts\$hostName"
$edgeRegPath = "HKCU:\SOFTWARE\Microsoft\Edge\NativeMessagingHosts\$hostName"

# --- 解析参数 ---
$ExtensionId = ""
$Uninstall = $false

$i = 0
while ($i -lt $args.Count) {
  switch ($args[$i]) {
    '--ExtensionId' {
      $i++
      if ($i -lt $args.Count) { $ExtensionId = $args[$i] }
    }
    '--Uninstall' {
      $Uninstall = $true
    }
  }
  $i++
}

# --- 卸载流程 ---
if ($Uninstall) {
  foreach ($regPath in @($chromeRegPath, $edgeRegPath)) {
    if (Test-Path $regPath) {
      Remove-Item -LiteralPath $regPath -Recurse -Force
      Write-Output "✅ 已移除注册表: $regPath"
    } else {
      Write-Output "ℹ️ 注册表项不存在，跳过: $regPath"
    }
  }

  $configPath = Join-Path $PSScriptRoot "config.json"
  if (Test-Path $configPath) {
    Remove-Item -LiteralPath $configPath -Force
    Write-Output "✅ 已删除生成的主机清单: $configPath"
  }

  return
}

# --- 注册流程 ---

if (-not $ExtensionId) {
  Write-Error "❌ 必须指定扩展 ID (ExtensionId)"
  Write-Error "请从 chrome://extensions 页面复制扩展 ID 后重试"
  Write-Error "用法: .\install-release.ps1 --ExtensionId ""abcdefghijklmnopabcdefghijklmnop"""
  exit 1
}

$ExtensionId = $ExtensionId.Trim()
if ($ExtensionId -notmatch '^[a-p]{32}$') {
  Write-Error "❌ 扩展 ID 格式不正确: $ExtensionId，需为 32 位小写字母 a-p，可在 chrome://extensions 页面复制"
  exit 1
}

$exePath = Join-Path $PSScriptRoot "nativehost.exe"
if (-not (Test-Path $exePath)) {
  Write-Error "❌ 未找到 $exePath，请确认已从 Release zip 完整解压后在 installer 目录中运行"
  exit 1
}

# --- 生成主机清单 ---
$configPath = Join-Path $PSScriptRoot "config.json"
$manifest = [ordered]@{
  name = $hostName
  description = "Bilibili Video Downloader Native Host"
  path = $exePath
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$json = ($manifest | ConvertTo-Json -Depth 10) + "`n"
# 5.1 写 UTF8 会带 BOM
[System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))

$head = [System.IO.File]::ReadAllBytes($configPath)
if ($head.Length -ge 3 -and $head[0] -eq 0xEF -and $head[1] -eq 0xBB -and $head[2] -eq 0xBF) {
  Write-Error "❌ config.json 意外被写入了 BOM，Chromium 将无法解析该清单"
  exit 1
}
Write-Output "✅ 已生成主机清单 (UTF-8 无 BOM): $configPath"

# --- 注册 Chromium 与 Edge 的 NativeMessagingHosts ---
foreach ($regPath in @($chromeRegPath, $edgeRegPath)) {
  if (-not (Test-Path (Split-Path -Parent $regPath))) {
    New-Item -Path (Split-Path -Parent $regPath) -ItemType Directory -Force | Out-Null
  }
  New-Item -Path $regPath -Value $configPath -Force | Out-Null
  Write-Output "✅ 已注册: $regPath"
}

Write-Output "✅ Native Messaging Host 注册成功！"
Write-Output "   主机程序: $exePath"
Write-Output "   主机清单: $configPath"
Write-Output "   扩展 ID:  $ExtensionId"
Write-Output ""
Write-Output "📝 如果之后重新加载扩展导致 ID 变化，请用新 ID 重新运行此脚本"
