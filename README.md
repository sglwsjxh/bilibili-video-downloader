# 🎯 B站视频下载器 (Bilibili Video Downloader)

> 一键提取 · 双轨下载 · FFmpeg 自动合成

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
  <img src="https://img.shields.io/badge/平台-Web-blue" alt="Platform">
  <img src="https://img.shields.io/badge/依赖-无-orange" alt="Dependencies">
</p>

---

## 📖 项目简介

**B站视频下载器** 是一款专为 [哔哩哔哩 (Bilibili)](https://www.bilibili.com) 设计的浏览器扩展。它能够智能解析视频页面中的 DASH 流，分离出**最高画质的视频轨**和**音频轨**，分别下载后通过本地 FFmpeg 无损合并，最终生成完整的 MP4 文件

- ✅ **纯净无广告** – 基于 Manifest V3，权限最小化  
- ✅ **高质量保存** – 保留原始画质和音质，支持 1080P+、Hi-Res 音频  
- ✅ **自动合成** – 利用自定义协议 `ffmpeg-run://` 一键调用 FFmpeg 合并文件  
- ✅ **跨浏览器** – 适用于所有 Chromium 内核浏览器（Chrome、Edge、夸克等）  

---

## 🚀 快速开始

### 1. 获取源代码

打开终端，执行以下命令将项目克隆到本地：

```bash
git clone https://github.com/sglwsjxh/bilibili-video-download.git
```

### 2. 安装 FFmpeg

插件合并音视频需要依赖 **FFmpeg**。推荐使用以下两种方式之一安装：

#### 方式一：使用 winget 快速安装（Windows 10/11 推荐）
打开命令提示符或 PowerShell，执行：
```bash
winget install FFmpeg
```
安装完成后，FFmpeg 会自动添加到系统环境变量中，无需手动配置

#### 方式二：手动下载并配置环境变量
- 访问 [FFmpeg 官方下载页面](https://ffmpeg.org/download.html)，选择适合您操作系统的版本（例如 Windows 的 `ffmpeg-release-full.7z`）。
- 解压到任意目录（如 `C:\ffmpeg`），然后将 `C:\ffmpeg\bin` 添加到系统环境变量 `Path` 中
- 验证安装：打开命令提示符，输入 `ffmpeg -version`，若显示版本信息则配置成功

### 3. 注册自定义协议 `ffmpeg-run`

为了让浏览器能调用本地 FFmpeg 命令，需要导入注册表文件：

- **双击运行`register.bat`** 文件

> 🔧 此步骤只需执行一次，它将 `ffmpeg-run://` 协议关联到 `run-ffmpeg.vbs` 脚本，由脚本负责启动 FFmpeg 合并命令

### 4. 自定义下载路径
- 默认下载目录为 `C:\Users\用户名\Downloads`，如需修改，请打开 `popup.js`，找到 `downloadsDir` 变量（约第 56 行），将其改为你的实际下载目录（注意使用双反斜杠 `\\` 或正斜杠 `/`）

### 5. 将插件加载到浏览器（以谷歌为例）

1. 打开浏览器，在地址栏输入 `chrome://extensions/` 并回车
2. **开启右上角的“开发者模式”**。
3. 点击左上角的 **“加载已解压的扩展程序”** 按钮
4. 选择 **项目根目录**（包含 `manifest.json` 的文件夹）

此时浏览器工具栏会出现插件图标，若未显示，请点击拼图图标 🧩 将其固定。

---

## 📸 使用方法

### 第一步：进入 B 站视频页面
打开任意 B 站视频（如 `https://www.bilibili.com/video/BV1xx...`），等待页面加载完成。建议先播放视频几秒钟，确保流地址已加载。

### 第二步：点击插件图标
点击浏览器右上角的插件图标，弹出操作面板：

- 如果检测成功，面板会显示视频标题和 **“⬇️ 下载视频”** 按钮。
- 如果显示“未检测到完整视频流”，请**刷新页面**（F5）或先播放视频，再次点击图标。

### 第三步：下载并合成
点击 **“⬇️ 下载视频”**，插件将依次执行：
1. 下载视频流（保存为 `video.mp4`）
2. 下载音频流（保存为 `audio.mp3`）
3. 自动调用 FFmpeg 合并两个文件，生成 `[视频标题].mp4`
4. 合并完成后自动删除临时文件

> ⏳ 下载时间取决于视频大小和网络速度，合成过程通常仅需几秒。

---

## ⚙️ 工作原理

1. **解析**：`content.js` 注入 B 站页面，从 `<script>` 标签中提取 DASH 流的 `base_url`（包含视频轨和音频轨的真实地址）
3. **下载**：用户点击下载按钮后，`popup.js` 从存储中读取链接，通过 `fetch` 获取二进制流并触发浏览器下载
4. **合成**：下载完成后，构造 `ffmpeg-run://` 协议 URL，浏览器唤起本地注册的 `run-ffmpeg.vbs` 脚本，脚本执行 FFmpeg 命令合并音视频，并清理临时文件

---

## 📄 许可证

本项目基于 MIT 许可证开源

详细条款请参见 [LICENSE](LICENSE) 文件
