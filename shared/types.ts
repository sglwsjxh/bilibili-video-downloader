export interface TrackInfo {
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

export interface StoredVideoInfo {
  selectedVideo: TrackInfo | null
  selectedAudio: TrackInfo | null
  availableVideoTracks: TrackInfo[]
  availableAudioTracks: TrackInfo[]
  qualityLabel: string
  title: string
}

export interface HostEnvelope {
  v: number
  type: string
  id?: string
  payload?: Record<string, unknown> | undefined
  error?: string
  [key: string]: unknown
}

export interface DownloadStartPayload {
  title: string
  video: TrackInfo
  audio: TrackInfo
  outputDir: string
}

export interface DownloadProgressPayload {
  track: string
  loaded: number
  total: number
  done: boolean
  msg?: string
}

export interface MergeProgressPayload {
  done: boolean
  msg?: string
}

export interface JobDonePayload {
  outputPath: string
}

export interface SelectDirPayload {
  defaultPath?: string | undefined
}

export interface SelectDirResultPayload {
  path: string
  cancel: boolean
}

export interface CancelPayload {
  jobId?: string | undefined
}

export interface DownloadProgressMessage extends DownloadProgressPayload {
  v: number
  type: 'download.progress' | 'download.done'
  id: string
  payload?: undefined
}

export interface MergeProgressMessage extends MergeProgressPayload {
  v: number
  type: 'merge.progress' | 'merge.done'
  id: string
  payload?: undefined
}

export interface JobDoneMessage extends JobDonePayload {
  v: number
  type: 'job.done'
  id: string
  payload?: undefined
}

export interface JobErrorMessage {
  v?: number
  type: 'job.error'
  id?: string
  error: string
  payload?: undefined
}

export interface SelectDirResultMessage {
  v?: number
  type: 'select.dir.result'
  id?: string
  path?: string
  cancel: boolean
  payload?: undefined
}

export interface HostStatusMessage {
  type: 'host.status'
  connected: boolean
}

export interface HostDisconnectedMessage {
  type: 'host.disconnected'
}

export type PopupMessage =
  | HostStatusMessage
  | HostDisconnectedMessage
  | DownloadProgressMessage
  | MergeProgressMessage
  | JobDoneMessage
  | JobErrorMessage
  | SelectDirResultMessage
