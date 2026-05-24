const NATIVE_HOST_NAME = 'com.sglwsjxh.bilibili_downloader'

let nativePort = null
let reconnectTimer = null
let popupPort = null
let currentJobId = null

function connectNative() {
  if (nativePort) return

  nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME)
  nativePort.onMessage.addListener(onNativeMessage)
  nativePort.onDisconnect.addListener(() => {
    nativePort = null
    if (popupPort) {
      popupPort.postMessage({ type: 'host.disconnected' })
    }
    scheduleReconnect()
  })
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(() => {
    connectNative()
  }, 3000)
}

function flattenPayload(msg) {
  if (msg.payload && typeof msg.payload === 'object') {
    return { ...msg, ...msg.payload, payload: undefined }
  }
  return msg
}

function onNativeMessage(msg) {
  const flat = flattenPayload(msg)
  switch (flat.type) {
    case 'download.progress':
    case 'download.done':
    case 'merge.progress':
    case 'merge.done':
    case 'job.done':
    case 'job.error':
    case 'select.dir.result':
      if (popupPort) popupPort.postMessage(flat)
      break
    case 'pong':
      break
  }
}

chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'popup') {
    popupPort = port
    connectNative()

    port.onMessage.addListener(msg => {
      switch (msg.action) {
        case 'getStatus':
          port.postMessage({ type: 'host.status', connected: !!nativePort })
          break

        case 'download':
          if (!nativePort) {
            port.postMessage({ type: 'job.error', error: '后端未连接' })
            return
          }
          currentJobId = msg.jobId || crypto.randomUUID()
          nativePort.postMessage({
            v: 1,
            type: 'download.start',
            id: currentJobId,
            payload: {
              title: msg.title,
              video: msg.video,
              audio: msg.audio,
              outputDir: msg.outputDir
            }
          })
          break

        case 'selectDir':
          if (!nativePort) {
            port.postMessage({ type: 'select.dir.result', cancel: true })
            return
          }
          nativePort.postMessage({
            v: 1,
            type: 'select.dir',
            id: crypto.randomUUID(),
            payload: { defaultPath: msg.defaultPath }
          })
          break

        case 'cancel':
          if (nativePort && currentJobId) {
            nativePort.postMessage({
              v: 1,
              type: 'cancel',
              id: currentJobId
            })
          }
          break
      }
    })

    port.onDisconnect.addListener(() => {
      popupPort = null
    })
  }
})

connectNative()
