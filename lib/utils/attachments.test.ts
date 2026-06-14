import { describe, expect, it } from '@jest/globals'
import { Message } from 'ai'
import {
  ACCEPTED_IMAGE_TYPES,
  contentTypeFromDataUrl,
  dataUrlByteSize,
  isAcceptedImageType,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_SIZE_BYTES,
  modelSupportsVision,
  sanitizeAttachments
} from './attachments'

const visionModel = { vision: true }
const textModel = { vision: false }

// Build a base64 data URL whose decoded size is exactly `bytes`.
function dataUrlOfSize(bytes: number, mime = 'image/png'): string {
  const base64 = Buffer.alloc(bytes, 0).toString('base64')
  return `data:${mime};base64,${base64}`
}

function userMessageWithAttachments(
  attachments: Array<{ url: string; contentType?: string; name?: string }>
): Message {
  return {
    id: '1',
    role: 'user',
    content: 'describe this',
    experimental_attachments: attachments
  } as Message
}

describe('modelSupportsVision', () => {
  it('returns true only when vision is true', () => {
    expect(modelSupportsVision(visionModel)).toBe(true)
    expect(modelSupportsVision(textModel)).toBe(false)
    expect(modelSupportsVision(null)).toBe(false)
    expect(modelSupportsVision(undefined)).toBe(false)
    expect(modelSupportsVision({})).toBe(false)
  })
})

describe('isAcceptedImageType', () => {
  it('accepts the configured image types', () => {
    for (const type of ACCEPTED_IMAGE_TYPES) {
      expect(isAcceptedImageType(type)).toBe(true)
    }
  })
  it('rejects everything else', () => {
    expect(isAcceptedImageType('application/pdf')).toBe(false)
    expect(isAcceptedImageType('text/plain')).toBe(false)
    expect(isAcceptedImageType('')).toBe(false)
    expect(isAcceptedImageType(undefined)).toBe(false)
  })
})

describe('contentTypeFromDataUrl', () => {
  it('extracts the mime type from a data URL', () => {
    expect(contentTypeFromDataUrl('data:image/png;base64,AAAA')).toBe(
      'image/png'
    )
    expect(contentTypeFromDataUrl('data:image/jpeg,AAAA')).toBe('image/jpeg')
  })
  it('returns undefined for non-data URLs', () => {
    expect(contentTypeFromDataUrl('https://example.com/x.png')).toBeUndefined()
  })
})

describe('dataUrlByteSize', () => {
  it('estimates the decoded size of a base64 data URL', () => {
    expect(dataUrlByteSize(dataUrlOfSize(100))).toBe(100)
    expect(dataUrlByteSize(dataUrlOfSize(1024))).toBe(1024)
  })
  it('returns 0 for non-data URLs', () => {
    expect(dataUrlByteSize('https://example.com/x.png')).toBe(0)
  })
})

describe('sanitizeAttachments', () => {
  it('strips all attachments for a model without vision support', () => {
    const messages = [
      userMessageWithAttachments([
        { url: dataUrlOfSize(10), contentType: 'image/png' }
      ])
    ]
    const result = sanitizeAttachments(messages, textModel)
    expect(result.removedForModel).toBe(true)
    expect(
      (result.messages[0] as any).experimental_attachments
    ).toBeUndefined()
    // Text content is preserved.
    expect(result.messages[0].content).toBe('describe this')
  })

  it('keeps valid attachments for a vision model', () => {
    const messages = [
      userMessageWithAttachments([
        { url: dataUrlOfSize(10), contentType: 'image/png' }
      ])
    ]
    const result = sanitizeAttachments(messages, visionModel)
    expect(result.removedForModel).toBe(false)
    expect(result.rejected).toBe(0)
    expect((result.messages[0] as any).experimental_attachments).toHaveLength(1)
  })

  it('rejects attachments with an unsupported content type', () => {
    const messages = [
      userMessageWithAttachments([
        { url: 'data:application/pdf;base64,AAAA', contentType: 'application/pdf' }
      ])
    ]
    const result = sanitizeAttachments(messages, visionModel)
    expect(result.rejected).toBe(1)
    expect(
      (result.messages[0] as any).experimental_attachments
    ).toBeUndefined()
  })

  it('rejects oversized attachments', () => {
    const messages = [
      userMessageWithAttachments([
        {
          url: dataUrlOfSize(MAX_ATTACHMENT_SIZE_BYTES + 1024),
          contentType: 'image/png'
        }
      ])
    ]
    const result = sanitizeAttachments(messages, visionModel)
    expect(result.rejected).toBe(1)
    expect(
      (result.messages[0] as any).experimental_attachments
    ).toBeUndefined()
  })

  it('enforces the maximum attachment count', () => {
    const many = Array.from({ length: MAX_ATTACHMENTS + 3 }, () => ({
      url: dataUrlOfSize(10),
      contentType: 'image/png'
    }))
    const result = sanitizeAttachments(
      [userMessageWithAttachments(many)],
      visionModel
    )
    expect((result.messages[0] as any).experimental_attachments).toHaveLength(
      MAX_ATTACHMENTS
    )
    expect(result.rejected).toBe(3)
  })

  it('infers content type from the data URL when omitted', () => {
    const messages = [
      userMessageWithAttachments([{ url: dataUrlOfSize(10, 'image/webp') }])
    ]
    const result = sanitizeAttachments(messages, visionModel)
    const kept = (result.messages[0] as any).experimental_attachments
    expect(kept).toHaveLength(1)
    expect(kept[0].contentType).toBe('image/webp')
  })

  it('passes through messages without attachments untouched', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'hello' } as Message
    ]
    const result = sanitizeAttachments(messages, visionModel)
    expect(result.messages[0]).toBe(messages[0])
    expect(result.removedForModel).toBe(false)
    expect(result.rejected).toBe(0)
  })

  it('handles empty / nullish input safely', () => {
    expect(sanitizeAttachments(undefined, visionModel).messages).toEqual([])
    expect(sanitizeAttachments(null, textModel).messages).toEqual([])
  })
})
