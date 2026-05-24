# B站视频下载器 (Bilibili Video Downloader)

> 前后端分离 · Go 原生后端 · Chrome Native Messaging

## 项目简介

B站视频下载器是一款专为哔哩哔哩 (Bilibili) 设计的浏览器扩展 + 本地后端工具。它采用前后端分离架构：

- **Chrome 扩展**（前端）：负责解析 B 站页面的 DASH 流地址，提供下载 UI
- **Go 后端**（本地服务）：负责 HTTP 下载视频/音频流，调用 FFmpeg 无损合并

## 架构

```
Chrome 扩展（前端）
  ├── content.js    解析 B 站页面 DASH 流
  ├── background.js  管理 Native Messaging 连接
  └── popup.js/html  用户界面 + 目录选择
        │
        │ Chrome Native Messaging
        ▼
Go 后端（本地 exe）
  ├── 下载器 (HTTP)   并行下载视频轨 + 音频轨
  ├── FFmpeg 合成器    无损合并为 MP4
  └── 目录选择器       原生文件夹弹窗
```

## 前置要求

- [Go](https://go.dev/dl/) 1.21+（编译后端）
- [FFmpeg](https://ffmpeg.org/)（音视频合并）
- Chrome / Edge 等 Chromium 浏览器

### 安装 FFmpeg

```bash
winget install FFmpeg
```

或手动下载并添加到系统 PATH。

## 安装

### 1. 编译 Go 后端

```bash
cd backend
go build -o ../installer/nativehost.exe ./cmd/nativehost/
```

### 2. 注册 Native Messaging Host

在 Chrome 中加载扩展后，从 `chrome://extensions` 复制扩展 ID，然后：

```powershell
.\installer\install.ps1 --ExtensionId "你的扩展ID"
```

如需卸载：

```powershell
.\installer\install.ps1 --Uninstall
```

### 3. 加载扩展

1. 打开 `chrome://extensions`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目根目录

## 使用方法

1. 打开任意 B 站视频页面
2. 点击扩展图标
3. 确认视频信息，选择下载目录
4. 点击"下载视频"
5. Go 后端自动下载并合并，实时显示进度

## 项目结构

```
main/
├── content.js          注入脚本：解析 DASH 流
├── background.js       Service Worker：Native Messaging 桥接
├── popup.js            弹窗 UI 逻辑
├── popup.html          弹窗界面
├── manifest.json       MV3 配置
├── shared/
│   └── dash-parser.js  纯 DASH 解析模块（含 vitest 测试）
├── tests/
│   ├── dash-parser.test.js
│   └── fixtures/
├── backend/
│   ├── cmd/nativehost/  Go 后端入口
│   └── internal/
│       ├── messaging/    Native Messaging 编解码
│       ├── downloader/   HTTP 下载器
│       ├── ffmpeg/       FFmpeg 合成
│       └── job/          任务管理
└── installer/
    ├── install.ps1       安装/卸载脚本
    └── nativehost.exe    编译后的后端程序
```

## 开发

```bash
# 前端测试
npm test

# 后端编译
cd backend && go build -o ../installer/nativehost.exe ./cmd/nativehost/
```

## 许可证

MIT License
