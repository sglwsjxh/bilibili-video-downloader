import { describe, it, expect } from 'vitest'
import {
  findDashSourcesFromScript,
  standardizeTrack,
  uniqueTracks,
  compareVideoTracks,
  compareAudioTracks,
  extractFallbackTracks,
} from '../shared/dash-parser.js'
import {
  mockDashData,
  mockDashDataWithBackup,
  mockDashDataEscapedUrl,
  buildScriptContent,
} from './fixtures/dash-sample.js'

describe('findDashSourcesFromScript', () => {
  it('extracts video and audio tracks from page script content', () => {
    const content = buildScriptContent(mockDashData)
    const sources = findDashSourcesFromScript(content)
    expect(sources).toHaveLength(1)
    expect(sources[0].video).toHaveLength(4)
    expect(sources[0].audio).toHaveLength(3)
  })

  it('returns empty array when no DASH data present', () => {
    const sources = findDashSourcesFromScript('<html><head></head></html>')
    expect(sources).toHaveLength(0)
  })

  it('handles multiple script tags with DASH data', () => {
    const content = buildScriptContent(mockDashData) + '\n' + buildScriptContent(mockDashDataWithBackup)
    const sources = findDashSourcesFromScript(content)
    expect(sources.length).toBeGreaterThanOrEqual(1)
  })

  it('ignores malformed JSON gracefully', () => {
    const content = 'random text dash video more random stuff {invalid json dash}'
    const sources = findDashSourcesFromScript(content)
    expect(sources).toEqual([])
  })
})

describe('standardizeTrack', () => {
  it('normalizes video track fields', () => {
    const raw = { id: 16, baseUrl: 'https://example.com/video.mp4', bandwidth: 3000000, width: 1920, height: 1080, codecs: 'avc1', mimeType: 'video/mp4' }
    const track = standardizeTrack(raw, 'video')
    expect(track).toMatchObject({
      id: 16,
      url: 'https://example.com/video.mp4',
      bandwidth: 3000000,
      width: 1920,
      height: 1080,
      qualityLabel: '1080P'
    })
  })

  it('normalizes audio track fields', () => {
    const raw = { id: 30216, baseUrl: 'https://example.com/audio.mp4', bandwidth: 320000, codecs: 'mp4a', mimeType: 'audio/mp4' }
    const track = standardizeTrack(raw, 'audio')
    expect(track).toMatchObject({
      id: 30216,
      url: 'https://example.com/audio.mp4',
      bandwidth: 320000,
      qualityLabel: '320kbps'
    })
  })

  it('supports alternate field names (baseUrl vs base_url)', () => {
    const raw1 = { id: 16, base_url: 'https://example.com/v1.mp4', bandwidth: 1000000 }
    const raw2 = { id: 16, baseUrl: 'https://example.com/v2.mp4', bandwidth: 1000000 }
    expect(standardizeTrack(raw1, 'video').url).toBe('https://example.com/v1.mp4')
    expect(standardizeTrack(raw2, 'video').url).toBe('https://example.com/v2.mp4')
  })

  it('unescapes backslash-forward-slash in URLs', () => {
    const raw = { id: 16, baseUrl: 'https:\\/\\/example.com\\/video.mp4', bandwidth: 1000000 }
    const track = standardizeTrack(raw, 'video')
    expect(track.url).toBe('https://example.com/video.mp4')
  })

  it('handles backupUrls as array and string', () => {
    const rawArray = { id: 16, baseUrl: 'https://example.com/v.mp4', backupUrls: ['https://b1.com/v.mp4', 'https://b2.com/v.mp4'], bandwidth: 1000000 }
    expect(standardizeTrack(rawArray, 'video').backupUrls).toHaveLength(2)

    const rawString = { id: 16, baseUrl: 'https://example.com/v.mp4', backupUrl: 'https://b1.com/v.mp4', bandwidth: 1000000 }
    expect(standardizeTrack(rawString, 'video').backupUrls).toHaveLength(1)
  })

  it('returns default values for missing fields', () => {
    const track = standardizeTrack({}, 'video')
    expect(track).toMatchObject({
      id: 0,
      url: '',
      backupUrls: [],
      bandwidth: 0,
      width: 0,
      height: 0,
      codecs: '',
      mimeType: '',
      qualityLabel: '视频'
    })
  })
})

describe('uniqueTracks', () => {
  it('deduplicates tracks by URL', () => {
    const tracks = [
      { url: 'https://example.com/a.mp4', id: 1 },
      { url: 'https://example.com/b.mp4', id: 2 },
      { url: 'https://example.com/a.mp4', id: 1 },
    ]
    expect(uniqueTracks(tracks)).toHaveLength(2)
  })

  it('filters out tracks with empty URL', () => {
    const tracks = [{ url: '', id: 1 }, { url: 'https://example.com/v.mp4', id: 2 }]
    expect(uniqueTracks(tracks)).toHaveLength(1)
  })
})

describe('compareVideoTracks', () => {
  it('sorts by height desc, then width, then bandwidth', () => {
    const tracks = [
      { height: 720, width: 1280, bandwidth: 2000000, id: 1 },
      { height: 1080, width: 1920, bandwidth: 3000000, id: 2 },
      { height: 480, width: 852, bandwidth: 800000, id: 3 },
    ]
    const sorted = [...tracks].sort(compareVideoTracks)
    expect(sorted[0].height).toBe(1080)
    expect(sorted[1].height).toBe(720)
    expect(sorted[2].height).toBe(480)
  })
})

describe('compareAudioTracks', () => {
  it('sorts by bandwidth desc, then id', () => {
    const tracks = [
      { bandwidth: 192000, id: 1 },
      { bandwidth: 320000, id: 2 },
      { bandwidth: 128000, id: 3 },
    ]
    const sorted = [...tracks].sort(compareAudioTracks)
    expect(sorted[0].bandwidth).toBe(320000)
    expect(sorted[1].bandwidth).toBe(192000)
    expect(sorted[2].bandwidth).toBe(128000)
  })
})

describe('extractFallbackTracks', () => {
  it('extracts tracks from raw script content without JSON parsing', () => {
    const content = `"video": [{"id": 16, "baseUrl": "https://example.com/v.mp4", "bandwidth": 3000000, "height": 1080}]`
    const tracks = extractFallbackTracks(content, 'video')
    expect(tracks).toHaveLength(1)
    expect(tracks[0].url).toBe('https://example.com/v.mp4')
    expect(tracks[0].qualityLabel).toBe('1080P')
  })

  it('returns empty array when no tracks found', () => {
    const tracks = extractFallbackTracks('no video here', 'video')
    expect(tracks).toHaveLength(0)
  })
})
