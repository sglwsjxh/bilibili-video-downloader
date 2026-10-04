<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface TrackInfo {
  url?: string
  qualityLabel?: string
  width?: number
  height?: number
  bandwidth?: number
}

interface VideoData {
  title?: string
  qualityLabel?: string
  selectedVideo?: TrackInfo
  selectedAudio?: TrackInfo
}

const DEFAULT_DIR = 'C:\\Users\\mark3\\Downloads'

let backgroundPort: any = null
let currentData: VideoData | null = null

const videoTitle = ref('正在获取视频信息...')
const dir = ref('')
const downloadVisible = ref(false)
const downloadDisabled = ref(false)
const statusText = ref('')
const statusVisible = ref(false)
const hostStatus = ref<boolean | null>(null)

const videoBarWidth = ref('0%')
const videoIndeterminate = ref(false)
const videoLabel = ref('视频: 等待中')
const videoRetry = ref(false)

const audioBarWidth = ref('0%')
const audioIndeterminate = ref(false)
const audioLabel = ref('音频: 等待中')
const audioRetry = ref(false)

const hostStatusText = computed(() =>
  hostStatus.value === null ? '○ 检测中' : hostStatus.value ? '● 后端已连接' : '○ 后端未连接'
)
const hostStatusColor = computed(() =>
  hostStatus.value === null ? undefined : hostStatus.value ? '#4caf50' : '#ff9999'
)

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function loadVideoInfo() {
  const tab = await getCurrentTab()

  chrome.storage.local.get('downloadDir', (result: any) => {
    dir.value = result.downloadDir || DEFAULT_DIR
  })

  if (!tab?.url?.includes('bilibili.com')) {
    videoTitle.value = '请在B站视频页面使用'
    downloadVisible.value = false
    return
  }

  const result = await chrome.storage.local.get(tab.url)
  const data = result[tab.url] as VideoData | undefined

  if (data?.selectedVideo?.url && data?.selectedAudio?.url) {
    videoTitle.value = `${data.title || 'B站视频'}\n${buildSelectedInfo(data)}`
    downloadVisible.value = true
    currentData = data
    return
  }

  videoTitle.value = '正在解析视频流...'
  downloadVisible.value = false
  currentData = null

  const reParsed: VideoData | null = await new Promise(resolve => {
    let settled = false
    chrome.tabs.sendMessage(tab.id!, { action: 'parse' }, (response: any) => {
      if (settled) return
      settled = true
      if (chrome.runtime.lastError || !response?.success) { resolve(null); return }
      if (response?.data) { resolve(response.data); return }
      chrome.storage.local.get(tab.url!, (r: any) => resolve(r[tab.url!] || null))
    })
    setTimeout(() => { if (!settled) { settled = true; resolve(null) } }, 5000)
  })

  if (reParsed?.selectedVideo?.url && reParsed?.selectedAudio?.url) {
    videoTitle.value = `${reParsed.title || 'B站视频'}\n${buildSelectedInfo(reParsed)}`
    downloadVisible.value = true
    currentData = reParsed
    return
  }

  videoTitle.value = '未检测到完整视频流，请刷新页面重试'
}

function buildSelectedInfo(data: VideoData) {
  const video = data.selectedVideo!
  const audio = data.selectedAudio!
  const videoQuality = video.qualityLabel || data.qualityLabel || '视频'
  const videoSize = video.width && video.height ? ` ${video.width}x${video.height}` : ''
  const videoBandwidth = video.bandwidth ? `${Math.round(video.bandwidth / 1000)}kbps` : ''
  const audioQuality = audio.qualityLabel || '音频'
  const audioBandwidth = audio.bandwidth ? `${Math.round(audio.bandwidth / 1000)}kbps` : ''
  return `[${videoQuality}]${videoSize}${videoBandwidth ? ` · 视频 ${videoBandwidth}` : ''}\n音频：${audioQuality}${audioBandwidth ? ` · ${audioBandwidth}` : ''}`
}

function connectBackground() {
  if (backgroundPort) return

  backgroundPort = chrome.runtime.connect({ name: 'popup' })

  backgroundPort.onMessage.addListener((msg: any) => {
    switch (msg.type) {
      case 'host.status':
        hostStatus.value = msg.connected
        break

      case 'host.disconnected':
        hostStatus.value = false
        showStatus('后端连接已断开，正在重连...')
        break

      case 'download.progress':
      case 'download.done':
        updateTrackProgress(msg.track, msg.loaded, msg.total, msg.done, msg.msg)
        if (msg.done) updateTrackStatus(msg.track, 'done')
        break

      case 'merge.progress':
      case 'merge.done':
        if (msg.done) {
          showStatus('FFmpeg 合成完成！')
          downloadDisabled.value = false
        } else {
          showStatus(msg.msg || '正在合成...')
        }
        break

      case 'job.done':
        showStatus(`下载完成：${msg.outputPath || ''}`)
        downloadDisabled.value = false
        break

      case 'job.error':
        showStatus(`失败：${msg.error || '未知错误'}`)
        downloadDisabled.value = false
        break

      case 'select.dir.result':
        if (!msg.cancel && msg.path) {
          dir.value = msg.path
          chrome.storage.local.set({ downloadDir: msg.path })
        }
        break
    }
  })

  backgroundPort.postMessage({ action: 'getStatus' })
}

function trackState(track: string) {
  const isVideo = track === 'video'
  return {
    name: isVideo ? '视频' : '音频',
    width: isVideo ? videoBarWidth : audioBarWidth,
    indeterminate: isVideo ? videoIndeterminate : audioIndeterminate,
    label: isVideo ? videoLabel : audioLabel,
  }
}

function updateTrackProgress(track: string, loaded: number, total: number, done: boolean, msg?: string) {
  const { name, width, indeterminate, label } = trackState(track)

  if (msg) {
    width.value = '100%'
    indeterminate.value = true
    label.value = `${name}: ${msg}`
    return
  }

  if (total) {
    const pct = done ? 100 : Math.min(99, Math.round((loaded / total) * 100))
    width.value = `${pct}%`
    indeterminate.value = false
    label.value = `${name}: ${pct}% (${(loaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB)`
    return
  }

  if (done) {
    width.value = '100%'
    indeterminate.value = false
    label.value = `${name}: ${(loaded / 1024 / 1024).toFixed(1)}MB (完成)`
    return
  }

  width.value = '100%'
  indeterminate.value = true
  label.value = `${name}: ${(loaded / 1024 / 1024).toFixed(1)}MB (进度未知)`
}

function updateTrackStatus(track: string, status: string) {
  const retry = track === 'video' ? videoRetry : audioRetry
  if (status === 'done') retry.value = false
}

function showStatus(msg: string) {
  statusText.value = msg
  statusVisible.value = true
}

function sanitize(title?: string) {
  return (title || 'video').replace(/[\\/*?:"<>|']/g, '_').substring(0, 80)
}

function onDownload() {
  if (!currentData?.selectedVideo?.url || !currentData?.selectedAudio?.url) {
    showStatus('没有可下载的完整资源')
    return
  }

  const outDir = dir.value.trim() || DEFAULT_DIR
  chrome.storage.local.set({ downloadDir: outDir })
  downloadDisabled.value = true
  showStatus('正在下载...')

  videoBarWidth.value = '0%'
  videoLabel.value = '视频: 等待中'
  audioBarWidth.value = '0%'
  audioLabel.value = '音频: 等待中'
  videoRetry.value = false
  audioRetry.value = false

  if (!backgroundPort) connectBackground()

  backgroundPort!.postMessage({
    action: 'download',
    jobId: crypto.randomUUID(),
    title: sanitize(currentData.title),
    video: currentData.selectedVideo,
    audio: currentData.selectedAudio,
    outputDir: outDir
  })
}

function onBrowseDir() {
  if (!backgroundPort) connectBackground()
  backgroundPort!.postMessage({
    action: 'selectDir',
    defaultPath: dir.value || DEFAULT_DIR
  })
}

function onDirChange() {
  chrome.storage.local.set({ downloadDir: dir.value })
}

function onRefresh() {
  videoTitle.value = '刷新中...'
  chrome.tabs.reload(undefined, { bypassCache: true }, () => {
    setTimeout(loadVideoInfo, 1500)
  })
}

onMounted(() => {
  connectBackground()
  loadVideoInfo()
})
</script>

<template>
  <div class="header">
    <img src="/icon.svg" alt="icon">
    <h2>B站视频下载器</h2>
    <span class="host-status" id="hostStatus" :style="hostStatus === null ? undefined : { color: hostStatus ? '#4caf50' : '#ff9999' }">{{ hostStatusText }}</span>
  </div>

  <div class="info-card">
    <div class="title" id="videoTitle">{{ videoTitle }}</div>

    <div class="dir-row">
      <input type="text" id="dirInput" placeholder="下载目录路径" v-model="dir" @change="onDirChange">
      <button id="browseDirBtn" @click="onBrowseDir">浏览</button>
    </div>

    <div class="progress-section">
      <div class="track-card">
        <div class="track-header">
          <span class="track-label" id="videoProgressLabel">{{ videoLabel }}</span>
          <button id="retryVideoBtn" class="retry-btn" v-show="videoRetry">重试</button>
        </div>
        <div class="progress-container">
          <div class="progress-bar-fill video-fill" id="videoProgressBar" :class="{ 'progress-indeterminate': videoIndeterminate }" :style="{ width: videoBarWidth }"></div>
        </div>
      </div>
      <div class="track-card">
        <div class="track-header">
          <span class="track-label" id="audioProgressLabel">{{ audioLabel }}</span>
          <button id="retryAudioBtn" class="retry-btn" v-show="audioRetry">重试</button>
        </div>
        <div class="progress-container">
          <div class="progress-bar-fill audio-fill" id="audioProgressBar" :class="{ 'progress-indeterminate': audioIndeterminate }" :style="{ width: audioBarWidth }"></div>
        </div>
      </div>
    </div>

    <div class="status-msg" id="statusMsg" :style="{ display: statusVisible ? 'block' : 'none' }">{{ statusText }}</div>

    <button id="downloadBtn" v-show="downloadVisible" :disabled="downloadDisabled" @click="onDownload">⬇️ 下载视频</button>
  </div>

  <hr>
  <button class="secondary" id="refreshBtn" @click="onRefresh">🔄 刷新信息</button>
</template>
