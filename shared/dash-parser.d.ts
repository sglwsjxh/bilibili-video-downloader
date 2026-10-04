export interface RawTrack {
  [key: string]: unknown
}

export interface ParsedTrack {
  id: number
  url: string
  backupUrls: string[]
  bandwidth: number
  width: number
  height: number
  codecs: string
  mimeType: string
  qualityLabel: string
}

export interface DashSource {
  video: RawTrack[]
  audio: RawTrack[]
}

export function findDashSourcesFromScript(content: string): DashSource[]
export function extractFallbackTracks(content: string, type: 'video' | 'audio'): ParsedTrack[]
export function standardizeTrack(track: RawTrack, type: 'video' | 'audio'): ParsedTrack
export function uniqueTracks(tracks: ParsedTrack[]): ParsedTrack[]
export function compareVideoTracks(a: ParsedTrack, b: ParsedTrack): number
export function compareAudioTracks(a: ParsedTrack, b: ParsedTrack): number
