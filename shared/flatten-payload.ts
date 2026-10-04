import type { HostEnvelope } from './types'

export function flattenPayload(msg: HostEnvelope): HostEnvelope {
  if (msg.payload && typeof msg.payload === 'object') {
    return { ...msg, ...msg.payload, payload: undefined }
  }
  return msg
}
