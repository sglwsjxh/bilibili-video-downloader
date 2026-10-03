$ErrorActionPreference = "Stop"
$hostName = "com.sglwsjxh.bilibili_downloader"
$chromeRegPath = "HKCU:\SOFTWARE\Google\Chrome\NativeMessagingHosts\$hostName"
$edgeRegPath = "HKCU:\SOFTWARE\Microsoft\Edge\NativeMessagingHosts\$hostName"

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

# 版本号来源
$repoRoot = Split-Path -Parent $PSScriptRoot
$version = (Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json).version
if (-not $version) {
  Write-Error "❌ 未能从 package.json 读取版本号: $repoRoot\package.json"
  exit 1
}

if (-not $HostPath) {
  # --- 默认路径：自动编译 ---
  if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Error "❌ 未找到 go 命令，无法编译后端"
    Write-Error "请安装 Go 1.21+ 并确保其在 PATH 中: https://go.dev/dl/"
    exit 1
  }

  $exePath = Join-Path $PSScriptRoot "nativehost.exe"

  # 占用中会编译失败
  if (Test-Path $exePath) {
    $holders = @(Get-Process -Name "nativehost" -ErrorAction SilentlyContinue)
    if ($holders.Count -gt 0) {
      $pidList = ($holders | ForEach-Object { $_.Id }) -join ", "
      Write-Output "⚠️  检测到 nativehost 进程仍在运行 (PID: $pidList)，它占用着 $exePath，编译覆盖很可能失败"
      Write-Output "   请先关闭 Chrome（或断开扩展连接）后重新运行；本脚本不会替你结束该进程"
    }
  }

  $srcDir = Join-Path $repoRoot "backend"
  Push-Location $srcDir
  try {
    go build -ldflags "-X main.version=$version" -o $exePath ./cmd/nativehost/
    if ($LASTEXITCODE -ne 0) {
      Write-Error "❌ Go 后端编译失败 (go build 退出码 $LASTEXITCODE)，请查看上方编译器输出"
      exit 1
    }
  } finally {
    Pop-Location
  }

  $HostPath = $exePath
  Write-Output "✅ 后端已编译完成 (版本 $version): $HostPath"
# --HostPath：自带二进制
} else {
  if (-not (Test-Path $HostPath)) {
    Write-Error "❌ 找不到后端程序: $HostPath"
    Write-Error "不带 --HostPath 时本脚本会自动编译 backend/ 下的 Go 后端"
    exit 1
  }
}

$HostPath = (Resolve-Path $HostPath).Path

# --- 生成主机清单 ---
$configPath = Join-Path $PSScriptRoot "config.json"
$manifest = [ordered]@{
  name = $hostName
  description = "Bilibili Video Downloader Native Host"
  path = $HostPath
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$json = ($manifest | ConvertTo-Json -Depth 10) + "`n"
# 5.1 写 UTF8 会带 BOM
[System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))

$head = [System.IO.File]::ReadAllBytes($configPath)
if ($head.Length -ge 3 -and $head[0] -eq 0xEF -and $head[1] -eq 0xBB -and $head[2] -eq 0xBF) {
  Write-Error "❌ config.json 意外被写入了 BOM，Chrome 将无法解析该清单"
  exit 1
}
Write-Output "✅ 已生成主机清单 (UTF-8 无 BOM): $configPath"

# --- 注册 Chrome 与 Edge 的 NativeMessagingHosts ---
foreach ($regPath in @($chromeRegPath, $edgeRegPath)) {
  if (-not (Test-Path (Split-Path -Parent $regPath))) {
    New-Item -Path (Split-Path -Parent $regPath) -ItemType Directory -Force | Out-Null
  }
  New-Item -Path $regPath -Value $configPath -Force | Out-Null
  Write-Output "✅ 已注册: $regPath"
}

Write-Output "✅ Native Messaging Host 安装成功！"
Write-Output "   主机程序: $HostPath"
Write-Output "   主机清单: $configPath"
Write-Output "   扩展 ID:  $ExtensionId"
Write-Output ""
Write-Output "📝 如果之后重新加载扩展导致 ID 变化，请重新运行此脚本"
