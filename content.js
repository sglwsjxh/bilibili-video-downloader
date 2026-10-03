function findDashSourcesFromScript(content) {
  const parsedObjects = findJsonObjectsContainingDash(content)
  const sources = []
  for (let parsedObject of parsedObjects) collectDashSources(parsedObject, sources)
  return sources
}

function findJsonObjectsContainingDash(content) {
  const objects = []
  const seen = new Set()
  let dashIndex = content.indexOf('dash')

  while (dashIndex !== -1) {
    let start = content.lastIndexOf('{', dashIndex)
    while (start !== -1) {
      const end = findMatchingToken(content, start, '{', '}')
      if (end !== -1) {
        const jsonText = content.slice(start, end + 1)
        if (!seen.has(jsonText) && jsonText.includes('dash')) {
          try {
            objects.push(JSON.parse(jsonText))
            seen.add(jsonText)
            break
          } catch (error) {
            seen.add(jsonText)
          }
        }
      }
      start = content.lastIndexOf('{', start - 1)
    }
    dashIndex = content.indexOf('dash', dashIndex + 4)
  }
  return objects
}

function collectDashSources(value, sources) {
  if (!value || typeof value !== 'object') return
  if (value.dash?.video && value.dash?.audio && Array.isArray(value.dash.video) && Array.isArray(value.dash.audio)) {
    sources.push({ video: value.dash.video, audio: value.dash.audio })
  }
  for (let key in value) collectDashSources(value[key], sources)
}

function extractFallbackTracks(content, type) {
  const tracks = []
  const keyPattern = new RegExp(`"${type}"\\s*:\\s*\\[`, 'gi')
  let match
  while ((match = keyPattern.exec(content))) {
    const arrayStart = content.indexOf('[', match.index)
    const arrayEnd = findMatchingToken(content, arrayStart, '[', ']')
    if (arrayStart === -1 || arrayEnd === -1) continue
    const arrayText = content.slice(arrayStart + 1, arrayEnd)
    const urlPattern = /"base(?:_url|Url)"\s*:\s*"([^"]+)"/gi
    let urlMatch
    while ((urlMatch = urlPattern.exec(arrayText))) {
      const context = getNearestObjectText(arrayText, urlMatch.index)
      tracks.push(standardizeTrack({
        id: readNumberField(context, 'id') || readNumberField(context, 'quality'),
        baseUrl: urlMatch[1],
        backupUrl: readStringArrayField(context, 'backup(?:_url|Url|_urls|Urls)'),
        bandwidth: readNumberField(context, 'bandwidth'),
        width: readNumberField(context, 'width'),
        height: readNumberField(context, 'height'),
        codecs: readStringField(context, 'codecs'),
        mimeType: readStringField(context, 'mime(?:_type|Type)')
      }, type))
    }
  }
  return tracks
}

function normalizeUrl(value) {
  if (!value || typeof value !== 'string') return ''
  return value.replace(/\\\//g, '/')
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function normalizeBackupUrls(value) {
  if (Array.isArray(value)) return value.map(normalizeUrl).filter(Boolean)
  if (typeof value === 'string') return [normalizeUrl(value)].filter(Boolean)
  return []
}

function standardizeTrack(track, type) {
  const url = normalizeUrl(track.base_url || track.baseUrl || '')
  const backupValue = track.backup_url || track.backupUrl || track.backup_urls || track.backupUrls || []
  const backupUrls = normalizeBackupUrls(backupValue)
  const id = toNumber(track.id || track.quality || 0)
  const bandwidth = toNumber(track.bandwidth || 0)
  const width = toNumber(track.width || 0)
  const height = toNumber(track.height || 0)
  const codecs = track.codecs || ''
  const mimeType = track.mime_type || track.mimeType || ''
  return {
    id, url, backupUrls, bandwidth, width, height, codecs, mimeType,
    qualityLabel: buildQualityLabel({ id, bandwidth, width, height }, type)
  }
}

function buildQualityLabel(track, type) {
  if (type === 'video') {
    if (track.height) return `${track.height}P`
    if (track.width) return `${track.width}px`
    if (track.id) return `视频 ${track.id}`
    return '视频'
  }
  if (track.bandwidth) return `${Math.round(track.bandwidth / 1000)}kbps`
  if (track.id) return `音频 ${track.id}`
  return '音频'
}

function uniqueTracks(tracks) {
  const seen = new Set()
  const result = []
  for (let track of tracks) {
    if (!track.url || seen.has(track.url)) continue
    seen.add(track.url)
    result.push(track)
  }
  return result
}

function compareVideoTracks(left, right) {
  return right.height - left.height || right.width - left.width || right.bandwidth - left.bandwidth || right.id - left.id
}

function compareAudioTracks(left, right) {
  return right.bandwidth - left.bandwidth || right.id - left.id
}

function getNearestObjectText(text, index) {
  const start = text.lastIndexOf('{', index)
  const end = start === -1 ? -1 : findMatchingToken(text, start, '{', '}')
  if (start === -1 || end === -1) return text
  return text.slice(start, end + 1)
}

function readNumberField(text, fieldPattern) {
  const match = text.match(new RegExp(`"${fieldPattern}"\\s*:\\s*(\\d+)`, 'i'))
  return match?.[1] ? Number(match[1]) : 0
}

function readStringField(text, fieldPattern) {
  const match = text.match(new RegExp(`"${fieldPattern}"\\s*:\\s*"([^"]*)"`, 'i'))
  return match?.[1] || ''
}

function readStringArrayField(text, fieldPattern) {
  const arrayMatch = text.match(new RegExp(`"${fieldPattern}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'i'))
  if (arrayMatch?.[1]) {
    return Array.from(arrayMatch[1].matchAll(/"([^"]+)"/g), m => m[1])
  }
  const stringValue = readStringField(text, fieldPattern)
  return stringValue ? [stringValue] : []
}

function findMatchingToken(text, start, openToken, closeToken) {
  if (start === -1 || text[start] !== openToken) return -1
  let depth = 0, inString = false, escaped = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === openToken) depth++
    else if (c === closeToken) { depth--; if (depth === 0) return i }
  }
  return -1
}

function findVideoAudioUrls(callback) {
  const scriptTags = document.querySelectorAll('script')
  const videoTracks = []
  const audioTracks = []

  for (let script of scriptTags) {
    const content = script.textContent || script.innerText || ''
    if (!content.includes('dash') || (!content.includes('video') && !content.includes('audio'))) continue

    const dashSources = findDashSourcesFromScript(content)
    for (let source of dashSources) {
      videoTracks.push(...source.video.map(track => standardizeTrack(track, 'video')))
      audioTracks.push(...source.audio.map(track => standardizeTrack(track, 'audio')))
    }

    if (!dashSources.length) {
      videoTracks.push(...extractFallbackTracks(content, 'video'))
      audioTracks.push(...extractFallbackTracks(content, 'audio'))
    }
  }

  const availableVideoTracks = uniqueTracks(videoTracks).sort(compareVideoTracks)
  const availableAudioTracks = uniqueTracks(audioTracks).sort(compareAudioTracks)
  const selectedVideo = availableVideoTracks[0] || null
  const selectedAudio = availableAudioTracks[0] || null

  const storeData = (selectedVideo || selectedAudio) ? {
    selectedVideo,
    selectedAudio,
    availableVideoTracks,
    availableAudioTracks,
    qualityLabel: selectedVideo?.qualityLabel || '',
    title: document.title.replace(/\s*[-_ ]?哔哩哔哩_bilibili\s*$/i, '').trim()
  } : null

  if (storeData) {
    chrome.storage.local.set({ [location.href]: storeData }, () => {
      if (callback) callback(storeData)
    })
  } else {
    if (callback) callback(null)
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'parse') {
    findVideoAudioUrls(data => {
      sendResponse({ success: true, data })
    })
    return true
  }
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findVideoAudioUrls)
} else {
  setTimeout(findVideoAudioUrls, 800)
}
