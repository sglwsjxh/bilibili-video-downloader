import { describe, it, expect } from 'vitest'
import { flattenPayload } from '../shared/flatten-payload'

describe('flattenPayload', () => {
  it('merges payload keys to the top level', () => {
    const msg = {
      v: 1,
      type: 'download.progress',
      id: 'job-1',
      payload: { track: 'video', loaded: 512, total: 1024, done: false }
    }
    const flat = flattenPayload(msg)
    expect(flat.v).toBe(1)
    expect(flat.type).toBe('download.progress')
    expect(flat.id).toBe('job-1')
    expect(flat.track).toBe('video')
    expect(flat.loaded).toBe(512)
    expect(flat.total).toBe(1024)
    expect(flat.done).toBe(false)
  })

  it('leaves no nested payload content after merge', () => {
    const flat = flattenPayload({ v: 1, type: 'job.done', id: 'job-1', payload: { outputPath: 'C:\\Downloads\\video.mp4' } })
    expect(flat.outputPath).toBe('C:\\Downloads\\video.mp4')
    expect(flat.payload).toBeUndefined()
  })

  it('keeps payload as an undefined own property', () => {
    const flat = flattenPayload({ v: 1, type: 'merge.done', id: 'job-1', payload: { done: true } })
    expect('payload' in flat).toBe(true)
    expect(flat.payload).toBeUndefined()
    expect(flat.done).toBe(true)
  })

  it('returns messages without payload as the same reference', () => {
    const msg = { v: 1, type: 'job.error', id: 'job-1', error: 'ffmpeg not found in PATH' }
    expect(flattenPayload(msg)).toBe(msg)
  })

  it('passes through null and non-object payloads unchanged', () => {
    const nullMsg = { v: 1, type: 'select.dir', id: 'a', payload: null }
    expect(flattenPayload(nullMsg)).toBe(nullMsg)

    const stringMsg = { v: 1, type: 'pong', id: 'b', payload: 'hi' }
    expect(flattenPayload(stringMsg)).toBe(stringMsg)
  })

  it('lets payload values override envelope keys on collision', () => {
    const flat = flattenPayload({ v: 1, type: 'select.dir.result', id: 'job-1', payload: { type: 'overridden', path: 'C:\\x', cancel: false } })
    expect(flat.type).toBe('overridden')
    expect(flat.path).toBe('C:\\x')
    expect(flat.cancel).toBe(false)
  })
})
