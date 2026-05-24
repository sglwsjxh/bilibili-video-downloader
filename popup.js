const DEFAULT_DIR = 'C:\\Users\\mark3\\Downloads'

let backgroundPort = null
let currentData = null

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function loadVideoInfo() {
  const tab = await getCurrentTab()
  const titleEl = document.getElementById('videoTitle')
  const downloadBtn = document.getElementById('downloadBtn')
  const dirInput = document.getElementById('dirInput')

  chrome.storage.local.get('downloadDir', result => {
    dirInput.value = result.downloadDir || DEFAULT_DIR
  })

  if (!tab?.url?.includes('bilibili.com')) {
    titleEl.innerText = '请在B站视频页面使用'
    downloadBtn.style.display = 'none'
    return
  }

  const result = await chrome.storage.local.get(tab.url)
  const data = result[tab.url]

  if (data?.selectedVideo?.url && data?.selectedAudio?.url) {
    titleEl.innerText = `${data.title || 'B站视频'}\n${buildSelectedInfo(data)}`
    downloadBtn.style.display = 'flex'
    currentData = data
    return
  }

  titleEl.innerText = '正在解析视频流...'
  downloadBtn.style.display = 'none'
  currentData = null

  const reParsed = await new Promise(resolve => {
    let settled = false
    chrome.tabs.sendMessage(tab.id, { action: 'parse' }, response => {
      if (settled) return
      settled = true
      if (chrome.runtime.lastError || !response?.success) { resolve(false); return }
      if (response?.data) { resolve(response.data); return }
      chrome.storage.local.get(tab.url, r => resolve(r[tab.url] || false))
    })
    setTimeout(() => { if (!settled) { settled = true; resolve(false) } }, 5000)
  })

  if (reParsed?.selectedVideo?.url && reParsed?.selectedAudio?.url) {
    titleEl.innerText = `${reParsed.title || 'B站视频'}\n${buildSelectedInfo(reParsed)}`
    downloadBtn.style.display = 'flex'
    currentData = reParsed
    return
  }

  titleEl.innerText = '未检测到完整视频流，请刷新页面重试'
}

function buildSelectedInfo(data) {
  const video = data.selectedVideo
  const audio = data.selectedAudio
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

  backgroundPort.onMessage.addListener(msg => {
    switch (msg.type) {
      case 'host.status':
        updateHostStatus(msg.connected)
        break

      case 'host.disconnected':
        updateHostStatus(false)
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
          document.getElementById('downloadBtn').disabled = false
        } else {
          showStatus(msg.msg || '正在合成...')
        }
        break

      case 'job.done':
        showStatus(`下载完成：${msg.outputPath || ''}`)
        document.getElementById('downloadBtn').disabled = false
        break

      case 'job.error':
        showStatus(`失败：${msg.error || '未知错误'}`)
        document.getElementById('downloadBtn').disabled = false
        break

      case 'select.dir.result':
        if (!msg.cancel && msg.path) {
          document.getElementById('dirInput').value = msg.path
          chrome.storage.local.set({ downloadDir: msg.path })
        }
        break
    }
  })

  backgroundPort.postMessage({ action: 'getStatus' })
}

function updateHostStatus(connected) {
  const el = document.getElementById('hostStatus')
  if (connected) {
    el.innerText = '● 后端已连接'
    el.style.color = '#4caf50'
  } else {
    el.innerText = '○ 后端未连接'
    el.style.color = '#ff9999'
  }
}

function updateTrackProgress(track, loaded, total, done, msg) {
  const prefix = track === 'video' ? 'video' : 'audio'
  const bar = document.getElementById(`${prefix}ProgressBar`)
  const label = document.getElementById(`${prefix}ProgressLabel`)
  const name = track === 'video' ? '视频' : '音频'

  if (msg) {
    bar.classList.add('progress-indeterminate')
    bar.style.width = '100%'
    label.innerText = `${name}: ${msg}`
    return
  }

  if (total) {
    const pct = done ? 100 : Math.min(99, Math.round((loaded / total) * 100))
    bar.classList.remove('progress-indeterminate')
    bar.style.width = `${pct}%`
    label.innerText = `${name}: ${pct}% (${(loaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB)`
    return
  }

  if (done) {
    bar.classList.remove('progress-indeterminate')
    bar.style.width = '100%'
    label.innerText = `${name}: ${(loaded / 1024 / 1024).toFixed(1)}MB (完成)`
    return
  }

  bar.classList.add('progress-indeterminate')
  bar.style.width = '100%'
  label.innerText = `${name}: ${(loaded / 1024 / 1024).toFixed(1)}MB (进度未知)`
}

function updateTrackStatus(track, status) {
  const retryBtn = document.getElementById(track === 'video' ? 'retryVideoBtn' : 'retryAudioBtn')
  if (status === 'done') retryBtn.style.display = 'none'
}

function showStatus(msg) {
  const el = document.getElementById('statusMsg')
  el.innerText = msg
  el.style.display = 'block'
}

function sanitize(title) {
  return (title || 'video').replace(/[\\/*?:"<>|']/g, '_').substring(0, 80)
}

document.getElementById('downloadBtn').addEventListener('click', () => {
  if (!currentData?.selectedVideo?.url || !currentData?.selectedAudio?.url) {
    showStatus('没有可下载的完整资源')
    return
  }

  const dir = document.getElementById('dirInput').value.trim() || DEFAULT_DIR
  chrome.storage.local.set({ downloadDir: dir })
  document.getElementById('downloadBtn').disabled = true
  showStatus('正在下载...')

  document.getElementById('videoProgressBar').style.width = '0%'
  document.getElementById('videoProgressLabel').innerText = '视频: 等待中'
  document.getElementById('audioProgressBar').style.width = '0%'
  document.getElementById('audioProgressLabel').innerText = '音频: 等待中'
  document.getElementById('retryVideoBtn').style.display = 'none'
  document.getElementById('retryAudioBtn').style.display = 'none'

  if (!backgroundPort) connectBackground()

  backgroundPort.postMessage({
    action: 'download',
    jobId: crypto.randomUUID(),
    title: sanitize(currentData.title),
    video: currentData.selectedVideo,
    audio: currentData.selectedAudio,
    outputDir: dir
  })
})

document.getElementById('browseDirBtn').addEventListener('click', () => {
  if (!backgroundPort) connectBackground()
  backgroundPort.postMessage({
    action: 'selectDir',
    defaultPath: document.getElementById('dirInput').value || DEFAULT_DIR
  })
})

document.getElementById('dirInput').addEventListener('change', () => {
  chrome.storage.local.set({ downloadDir: document.getElementById('dirInput').value })
})

document.getElementById('refreshBtn').addEventListener('click', () => {
  document.getElementById('videoTitle').innerText = '刷新中...'
  chrome.tabs.reload(undefined, { bypassCache: true }, () => {
    setTimeout(loadVideoInfo, 1500)
  })
})

connectBackground()
loadVideoInfo()
