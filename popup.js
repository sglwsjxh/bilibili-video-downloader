async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function loadVideoInfo() {
  const tab = await getCurrentTab()
  const titleEl = document.getElementById('videoTitle')
  const downloadBtn = document.getElementById('downloadBtn')

  if (!tab?.url?.includes('bilibili.com')) {
    titleEl.innerText = '请在B站视频页面使用'
    downloadBtn.style.display = 'none'
    return
  }

  const result = await chrome.storage.local.get(tab.url)
  const data = result[tab.url]

  if (data?.videoUrl || data?.audioUrl) {
    titleEl.innerText = (data.title || 'B站视频') + '\n请刷新页面重新解析'
    downloadBtn.style.display = 'none'
    window.currentData = null
    return
  }

  if (!data?.selectedVideo?.url || !data?.selectedAudio?.url) {
    titleEl.innerText = '正在解析视频流...'
    downloadBtn.style.display = 'none'
    window.currentData = null

    const reParsed = await new Promise(resolve => {
      let settled = false

      chrome.tabs.sendMessage(tab.id, { action: 'parse' }, response => {
        if (settled) return
        settled = true

        if (chrome.runtime.lastError || !response?.success) {
          resolve(false)
          return
        }

        if (response?.data) {
          resolve(response.data)
          return
        }

        chrome.storage.local.get(tab.url, r => resolve(r[tab.url] || false))
      })

      setTimeout(() => {
        if (!settled) { settled = true; resolve(false) }
      }, 5000)
    })

    if (reParsed?.selectedVideo?.url && reParsed?.selectedAudio?.url) {
      titleEl.innerText = `${reParsed.title || 'B站视频'}\n${buildSelectedInfo(reParsed)}`
      downloadBtn.style.display = 'flex'
      window.currentData = reParsed
      return
    }

    titleEl.innerText = '未检测到完整视频流，请刷新页面重试'
    return
  }

  titleEl.innerText = `${data.title || 'B站视频'}\n${buildSelectedInfo(data)}`
  downloadBtn.style.display = 'flex'
  window.currentData = data
}

function sanitize(title) {
  return (title || 'video').replace(/[\\/*?:"<>|']/g, '_').substring(0, 80)
}

function buildSelectedInfo(data) {
  const video = data.selectedVideo
  const audio = data.selectedAudio
  const videoQuality = video.qualityLabel || data.qualityLabel || '视频'
  const videoSize = video.width && video.height ? ` ${video.width}x${video.height}` : ''
  const videoBandwidth = formatBandwidth(video.bandwidth)
  const audioQuality = audio.qualityLabel || '音频'
  const audioBandwidth = formatBandwidth(audio.bandwidth)

  return `[${videoQuality}]${videoSize}${videoBandwidth ? ` · 视频 ${videoBandwidth}` : ''}\n音频：${audioQuality}${audioBandwidth ? ` · ${audioBandwidth}` : ''}`
}

function formatBandwidth(value) {
  if (!value) return ''
  return `${Math.round(value / 1000)}kbps`
}

function runFFmpegMerge(videoFile, audioFile, outputFile) {
  const downloadsDir = 'C:\\Users\\mark3\\Downloads'
  const cmd = `cd /d "${downloadsDir}" && ffmpeg -y -i "${videoFile}" -i "${audioFile}" -c copy "${outputFile}" && del "${videoFile}" "${audioFile}" && exit`
  const encodedCmd = encodeURIComponent(cmd)
  const ffmpegUrl = `ffmpeg-run://${encodedCmd}`

  // chrome.tabs.create 是唯一能触发自定义协议的途径（带合成手势），新标签页在后台创建并立即关闭
  chrome.tabs.create({ url: ffmpegUrl, active: false }, tab => {
    setTimeout(() => chrome.tabs.remove(tab.id), 100)
  })

  console.log('[ffmpeg] triggered:', ffmpegUrl.substring(0, 60) + '...')
}

function formatSize(bytes) {
  return (bytes / 1024 / 1024).toFixed(1)
}

function getTrackUi(track) {
  const prefix = track === 'video' ? 'video' : 'audio'
  return {
    bar: document.getElementById(`${prefix}ProgressBar`),
    label: document.getElementById(`${prefix}ProgressLabel`),
    retryBtn: document.getElementById(track === 'video' ? 'retryVideoBtn' : 'retryAudioBtn'),
    name: track === 'video' ? '视频' : '音频'
  }
}

function updateTrackProgress(track, loaded, total, done, message) {
  const ui = getTrackUi(track)
  const loadedMb = formatSize(loaded)

  if (message) {
    ui.bar.classList.add('progress-indeterminate')
    ui.bar.style.width = '100%'
    ui.label.innerText = `${ui.name}: ${message}`
    return
  }

  if (total) {
    const pct = done ? 100 : Math.min(99, Math.round((loaded / total) * 100))
    ui.bar.classList.remove('progress-indeterminate')
    ui.bar.style.width = `${pct}%`
    ui.label.innerText = `${ui.name}: ${pct}% (${loadedMb}MB / ${formatSize(total)}MB)`
    return
  }

  if (done) {
    ui.bar.classList.remove('progress-indeterminate')
    ui.bar.style.width = '100%'
    ui.label.innerText = `${ui.name}: ${loadedMb}MB (完成)`
    return
  }

  ui.bar.classList.add('progress-indeterminate')
  ui.bar.style.width = '100%'
  ui.label.innerText = `${ui.name}: ${loadedMb}MB (进度未知)`
}

function resetTrackUi(track) {
  const ui = getTrackUi(track)
  ui.bar.style.width = '0%'
  ui.bar.classList.remove('progress-indeterminate')
  ui.label.innerText = `${ui.name}: 等待中`
  ui.retryBtn.style.display = 'none'
}

async function createDownloadPort() {
  const tab = await getCurrentTab()
  if (!tab?.id || !tab?.url?.includes('bilibili.com')) {
    throw new Error('请在B站视频页面使用')
  }

  return new Promise((resolve, reject) => {
    const port = chrome.tabs.connect(tab.id, { name: 'download' })
    const timeout = setTimeout(() => {
      port.disconnect()
      reject(new Error('内容脚本未响应，请刷新B站页面'))
    }, 3000)

    const onReady = msg => {
      if (msg.type === 'ready') {
        clearTimeout(timeout)
        port.onMessage.removeListener(onReady)
        resolve(port)
      }
    }

    port.onMessage.addListener(onReady)

    port.onDisconnect.addListener(() => {
      clearTimeout(timeout)
      port.onMessage.removeListener(onReady)
      const errMsg = chrome.runtime.lastError?.message || '内容脚本未加载'
      reject(new Error(errMsg))
    })
  })
}

function createTrackState() {
  return {
    video: { status: 'pending', loaded: 0, total: 0, error: '' },
    audio: { status: 'pending', loaded: 0, total: 0, error: '' }
  }
}

function getTrackRequest(data, track) {
  const trackData = track === 'video' ? data.selectedVideo : data.selectedAudio
  return {
    url: trackData.url,
    backupUrls: Array.isArray(trackData.backupUrls) ? trackData.backupUrls : [],
    filename: track === 'video' ? 'video.mp4' : 'audio.mp3',
    track
  }
}

function showTrackFailure(track, error) {
  const ui = getTrackUi(track)
  ui.retryBtn.style.display = 'block'
  ui.label.innerText = `${ui.name}: 下载失败 - ${error}`
  ui.label.style.color = '#ff9999'
}

async function downloadTracks(data) {
  const state = createTrackState()
  const port = await createDownloadPort()
  const videoReq = getTrackRequest(data, 'video')
  const audioReq = getTrackRequest(data, 'audio')
  const outputFile = sanitize(data.title) + '.mp4'
  let mergeStarted = false

  resetTrackUi('video')
  resetTrackUi('audio')

  function maybeMerge() {
    if (mergeStarted || state.video.status !== 'done' || state.audio.status !== 'done') return

    mergeStarted = true
    setTimeout(() => {
      runFFmpegMerge(videoReq.filename, audioReq.filename, outputFile)
      document.getElementById('downloadBtn').disabled = false
      port.disconnect()
    }, 1000)
  }

  function sendDownload(track) {
    const ui = getTrackUi(track)
    const req = track === 'video' ? videoReq : audioReq
    state[track] = { status: 'downloading', loaded: 0, total: 0, error: '' }
    ui.retryBtn.style.display = 'none'
    ui.bar.style.width = '0%'
    ui.bar.classList.remove('progress-indeterminate')
    ui.label.style.color = '#e0e0e0'
    ui.label.innerText = `${ui.name}: 0% (0.0MB / 0.0MB)`
    port.postMessage({ action: 'download', ...req })
  }

  port.onMessage.addListener(message => {
    if (!message?.track || !state[message.track]) return

    const track = message.track
    if (message.type === 'progress') {
      state[track].loaded = message.loaded || 0
      state[track].total = message.total || 0
      updateTrackProgress(track, state[track].loaded, state[track].total, message.done, message.message)

      if (message.done) {
        state[track].status = 'done'
        maybeMerge()
      }
      return
    }

    if (message.type === 'error') {
      state[track].status = 'failed'
      state[track].error = message.error || '下载失败'
      showTrackFailure(track, state[track].error)
    }
  })

  port.onDisconnect.addListener(() => {
    if (mergeStarted) return

    for (let track of ['video', 'audio']) {
      if (state[track].status === 'downloading') {
        state[track].status = 'failed'
        state[track].error = '下载连接已断开'
        showTrackFailure(track, state[track].error)
      }
    }
    document.getElementById('downloadBtn').disabled = false
  })

  document.getElementById('retryVideoBtn').onclick = () => sendDownload('video')
  document.getElementById('retryAudioBtn').onclick = () => sendDownload('audio')

  sendDownload('video')
  sendDownload('audio')
}

document.getElementById('downloadBtn').addEventListener('click', async () => {
  const data = window.currentData
  if (!data?.selectedVideo?.url || !data?.selectedAudio?.url) {
    document.getElementById('videoTitle').innerText = '没有可下载的完整资源'
    return
  }

  document.getElementById('downloadBtn').disabled = true
  try {
    await downloadTracks(data)
  } catch (error) {
    document.getElementById('downloadBtn').disabled = false
    document.getElementById('videoTitle').innerText = '下载失败：' + (error.message || error)
  }
})

document.getElementById('refreshBtn').addEventListener('click', () => {
  document.getElementById('videoTitle').innerText = '刷新中...'
  chrome.tabs.reload(undefined, { bypassCache: true }, () => {
    setTimeout(loadVideoInfo, 1500)
  })
})

loadVideoInfo()
