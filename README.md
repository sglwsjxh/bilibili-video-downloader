# B 站视频下载器 (Bilibili Video Downloader)

> Go Native Host · Chromium Native Messaging

## 项目简介

B 站视频下载器是一款专为哔哩哔哩 (Bilibili) 的 Windows 用户设计的浏览器扩展 + 本地后端工具，采用前后端分离架构：

- **Chromium 扩展**（前端）：负责解析 B 站页面的 DASH 流地址，提供下载 UI
- **Go 后端**（本地服务）：负责 HTTP 下载视频/音频流，调用 FFmpeg 无损合并

## 架构

```
前端 (WXT + Vue 3 + Vite 构建)
  ├── entrypoints/content.ts     内容脚本：解析 B 站页面 DASH 流
  ├── entrypoints/background.ts  Service Worker：Native Messaging 桥接
  └── entrypoints/popup/         Vue 3 SFC 弹窗 UI
        │
        │ Chromium Native Messaging
        ▼
Go 后端（本地 exe，未变）
  ├── 下载器 (HTTP)   并行下载视频轨 + 音频轨
  ├── FFmpeg 合成器    无损合并为 MP4
  └── 目录选择器       原生文件夹弹窗
```

## 前置要求

- [Node.js](https://nodejs.org/) 22+（前端构建）
- [Go](https://go.dev/dl/)（编译后端）
- [FFmpeg](https://ffmpeg.org/)（音视频合并）
- Chrome / Edge 等 Chromium 浏览器

### 安装 FFmpeg

```bash
winget install FFmpeg
```

或手动下载并添加到系统 PATH

## 安装

首次使用只需在项目根目录运行：

```powershell
.\installer\install.ps1
```

脚本会按顺序自动完成：

1. **构建前端**（首次自动 `npm install` 再 `npm run build`，产物在 `.output/chrome-mv3`）
2. **编译后端**（`go build`，版本号取自 `package.json`，输出 `installer/nativehost.exe`）
3. **提示输入扩展 ID**：
   - 首次运行：打开 `chrome://extensions` → 开启开发者模式 → 加载已解压的扩展程序 → 选择 `.output/chrome-mv3` → 复制扩展 ID 粘贴回终端
   - 已注册过：检测到保存的 ID，直接回车沿用，或输入新 ID
4. **写入配置 + 注册**（生成 `installer/config.json`，向 Chromium 与 Edge 的 `HKCU` 注册表写入 Native Messaging Host）

常用参数：

- `--ExtensionId <id>` 直接指定扩展 ID，跳过交互提示
- `--no-frontend` 仅编译后端
- `--no-backend` 仅构建前端
- `--no-register` 仅构建不注册
- `--Uninstall` 卸载（清理注册表与生成的 `config.json`）

卸载示例：

```powershell
.\installer\install.ps1 --Uninstall
```

> 扩展 ID 每次重新加载都可能变化，变化后重跑一次 `install.ps1` 即可（会复用已保存的 ID，回车确认）

## 使用方法

1. 打开任意 B 站视频页面
2. 点击扩展图标
3. 确认视频信息，选择下载目录
4. 点击 "下载视频"
5. Go 后端自动下载并合并，实时显示进度

## 项目结构

```
bilibili-video-downloader/
├── wxt.config.ts           WXT 配置 模块 权限 manifest 覆盖
├── tsconfig.json           TypeScript 配置 extends .wxt/tsconfig.json
├── package.json            npm 元数据 脚本 版本号唯一来源
├── entrypoints/
│   ├── content.ts          内容脚本 导入 shared/dash-parser.js
│   ├── background.ts       Service Worker 原 background.js 逻辑
│   └── popup/
│       ├── index.html      弹窗入口 声明 action icons
│       ├── main.ts         Vue 3 启动
│       ├── App.vue         弹窗组件 原 popup.js/html 逻辑 样式
│       └── style.css       弹窗样式 原内联 CSS 迁移
├── shared/
│   ├── dash-parser.js      纯 DASH 解析 单一源 tests content.ts 共用
│   ├── dash-parser.d.ts    类型声明
│   ├── flatten-payload.ts  协议消息扁平化工具
│   └── types.ts            协议类型 镜像 Go 端 messages.go
├── public/                 图标 icon-16/32/48/64/128.png icon.svg
├── tests/
│   ├── dash-parser.test.js 16 cases
│   ├── flatten-payload.test.js 6 cases
│   └── fixtures/
├── backend/                Go 后端
│   ├── cmd/nativehost/
│   └── internal/
├── installer/
│   ├── install.ps1         安装 卸载 自动编译后端 生成配置 注册
│   └── config.json         运行时生成 不进版本库
├── .output/                构建产物 gitignored 加载扩展选此目录
└── .wxt/                   WXT 内部缓存 gitignored
```

`installer/nativehost.exe` 由 `install.ps1` 编译生成，同样不进版本库

## 开发

```bash
# 依赖安装
npm install

# 前端开发（热重载，输出到 .output/chrome-mv3-dev）
npm run dev

# 前端构建（生产产物到 .output/chrome-mv3）
npm run build

# 打包发布 zip
npm run zip

# 类型检查
npm run compile

# 前端测试
npm test

# 后端编译（一般交给 install.ps1 即可，手动编译用这条）
cd backend && go build -ldflags "-X main.version=2.0.0" -o ../installer/nativehost.exe ./cmd/nativehost/
cd ..

# 后端测试
cd backend && go test ./...
cd ..
```

### 版本号

`package.json` 的 `version` 是唯一来源，`install.ps1` 读它来注入 Go 二进制版本（`-X main.version=`），WXT 构建时也会把它写入生成的 `manifest.json`，发版时只需改 `package.json` 即可（Chromium 要求 1-4 位数字且每段 ≤ 65535）

## 已知限制

- 仅 Windows（目录选择弹窗依赖 PowerShell + WinForms）
- 需要登录才能观看的付费/会员内容可能会下载失败（链路不携带 B 站 cookie）
- `nativehost.exe` 被占用时（扩展正在运行）无法覆盖编译，关掉 Chromium 再重跑 `install.ps1` 即可

## 许可证

[MIT License](LICENSE)
