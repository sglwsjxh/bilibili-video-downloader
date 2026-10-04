$ErrorActionPreference = "Stop"
$hostName = "com.sglwsjxh.bilibili_downloader"
$chromeRegPath = "HKCU:\SOFTWARE\Google\Chrome\NativeMessagingHosts\$hostName"
$edgeRegPath = "HKCU:\SOFTWARE\Microsoft\Edge\NativeMessagingHosts\$hostName"

# --- 解析参数 ---
$ExtensionId = ""
$Uninstall = $false
$NoFrontend = $false
$NoBackend = $false
$NoRegister = $false

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
    '--no-frontend' { $NoFrontend = $true }
    '--no-backend' { $NoBackend = $true }
    '--no-register' { $NoRegister = $true }
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
if ($NoFrontend -and $NoBackend -and $NoRegister) {
  Write-Output "ℹ️ 前端构建、后端编译、注册全部已跳过，无事可做"
  exit 0
}

# 版本号来源
$repoRoot = Split-Path -Parent $PSScriptRoot
$exePath = Join-Path $PSScriptRoot "nativehost.exe"
$version = (Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json).version
if (-not $version) {
  Write-Error "❌ 未能从 package.json 读取版本号: $repoRoot\package.json"
  exit 1
}

# --- 构建前端 ---
if (-not $NoFrontend) {
  if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "❌ 未找到 node 或 npm 命令，无法构建前端，请安装 Node.js 22+ 并确保其在 PATH 中: https://nodejs.org/"
    exit 1
  }
  Push-Location $repoRoot
  try {
    if (-not (Test-Path "node_modules")) {
      Write-Output "ℹ️ 未找到 node_modules，先执行 npm install"
      npm install
      if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ npm install 失败 (退出码 $LASTEXITCODE)，请查看上方输出"
        exit 1
      }
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
      Write-Error "❌ WXT 前端构建失败 (npm run build 退出码 $LASTEXITCODE)，请查看上方输出"
      exit 1
    }
  } finally {
    Pop-Location
  }
  Write-Output "✅ 前端已构建: $(Join-Path $repoRoot '.output\chrome-mv3')"
}

# --- 编译 Go 后端 ---
if (-not $NoBackend) {
  if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Error "❌ 未找到 go 命令，无法编译后端"
    Write-Error "请安装 Go 并确保其在 PATH 中: https://go.dev/dl/"
    exit 1
  }

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

  $exePath = (Resolve-Path $exePath).Path
  Write-Output "✅ 后端已编译完成 (版本 $version): $exePath"
}

# --- 注册 Native Messaging Host ---
if (-not $NoRegister) {
  $configPath = Join-Path $PSScriptRoot "config.json"
  if ($NoBackend -and -not (Test-Path $exePath)) {
    Write-Error "❌ 已跳过后端编译但未找到 $exePath，请先去掉 --no-backend 完整运行一次"
    exit 1
  }

  if ($ExtensionId) { $ExtensionId = $ExtensionId.Trim() } else {
    $savedId = ""
    if (Test-Path $configPath) {
      $m = [regex]::Match((Get-Content $configPath -Raw), 'chrome-extension://([a-p]{32})/')
      if ($m.Success) { $savedId = $m.Groups[1].Value }
    }
    if ($savedId) {
      $typed = (Read-Host "📝 检测到已注册的扩展 ID: $savedId，回车沿用，或输入新 ID: ").Trim()
      if ($typed) { $ExtensionId = $typed } else { $ExtensionId = $savedId }
    } else {
      $ExtensionId = (Read-Host "📝 请在 chrome://extensions 加载 .output\chrome-mv3 目录后复制扩展 ID 并粘贴: ").Trim()
      if (-not $ExtensionId) {
        Write-Error "❌ 扩展 ID 不能为空"
        exit 1
      }
    }
  }
  if ($ExtensionId -notmatch '^[a-p]{32}$') {
    Write-Error "❌ 扩展 ID 格式不正确: $ExtensionId，需为 32 位小写字母 a-p，可在 chrome://extensions 页面复制"
    Write-Error "用法: .\install.ps1 --ExtensionId ""abcdefghijklmnopabcdefghijklmnop""，非交互环境必须传此参数"
    exit 1
  }

  # --- 生成主机清单 ---
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
}

# --- 结果摘要 ---
if (-not $NoRegister) {
  Write-Output "✅ Native Messaging Host 安装成功！"
  Write-Output "   主机程序: $exePath"
  Write-Output "   主机清单: $configPath"
  Write-Output "   扩展 ID:  $ExtensionId"
} else { Write-Output "ℹ️ 已跳过注册 (--no-register)" }
if ($NoFrontend) { Write-Output "ℹ️ 已跳过前端构建 (--no-frontend)" }
if ($NoBackend) { Write-Output "ℹ️ 已跳过后端编译 (--no-backend)" }
Write-Output ""
Write-Output "📝 如果之后重新加载扩展导致 ID 变化，请重新运行此脚本"
