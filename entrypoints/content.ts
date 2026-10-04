import {
  compareAudioTracks,
  compareVideoTracks,
  extractFallbackTracks,
  findDashSourcesFromScript,
  standardizeTrack,
  uniqueTracks
} from '../shared/dash-parser.js'
import type { StoredVideoInfo, TrackInfo } from '../shared/types'

type RawTrack = Record<string, unknown>
type DashSource = { video: RawTrack[]; audio: RawTrack[] }

export default defineContentScript({
  matches: ['https://www.bilibili.com/*'],
  main() {
    function findVideoAudioUrls(callback?: (data: StoredVideoInfo | null) => void) {
      const scriptTags = document.querySelectorAll('script')
      const videoTracks: TrackInfo[] = []
      const audioTracks: TrackInfo[] = []

      for (let script of scriptTags) {
        const content = script.textContent || script.innerText || ''
        if (!content.includes('dash') || (!content.includes('video') && !content.includes('audio'))) continue

        const dashSources: DashSource[] = findDashSourcesFromScript(content)
        for (let source of dashSources) {
          videoTracks.push(...source.video.map((track: RawTrack) => standardizeTrack(track, 'video')))
          audioTracks.push(...source.audio.map((track: RawTrack) => standardizeTrack(track, 'audio')))
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

      const storeData: StoredVideoInfo | null = (selectedVideo || selectedAudio) ? {
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
      document.addEventListener('DOMContentLoaded', () => findVideoAudioUrls())
    } else {
      setTimeout(findVideoAudioUrls, 800)
    }
  }
})
