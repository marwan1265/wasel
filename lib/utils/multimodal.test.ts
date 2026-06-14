import { describe, expect, it } from '@jest/globals'
import { CoreMessage, Message } from 'ai'
import { ExtendedCoreMessage } from '../types'
import { truncateMessages } from './context-window'
import { convertToExtendedCoreMessages, convertToUIMessages } from './index'

describe('convertToExtendedCoreMessages (persistence)', () => {
  it('does not persist raw image bytes from attachments', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'what is this?',
        experimental_attachments: [
          { name: 'a.png', contentType: 'image/png', url: 'data:image/png;base64,AAAA' }
        ]
      } as Message
    ]

    const extended = convertToExtendedCoreMessages(messages)
    const serialized = JSON.stringify(extended)
    // The text is kept...
    expect(serialized).toContain('what is this?')
    // ...but no image bytes / parts are persisted.
    expect(serialized).not.toContain('AAAA')
    expect(serialized.toLowerCase()).not.toContain('"type":"image"')
  })
})

describe('convertToUIMessages (image attachments)', () => {
  it('reconstructs experimental_attachments from persisted image parts', () => {
    const stored: ExtendedCoreMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'what is this?' },
          { type: 'image', image: 'data:image/png;base64,AAAA', mimeType: 'image/png' }
        ] as any
      }
    ]

    const ui = convertToUIMessages(stored)
    expect(ui).toHaveLength(1)
    expect(ui[0].content).toBe('what is this?')
    expect(ui[0].experimental_attachments).toHaveLength(1)
    expect(ui[0].experimental_attachments?.[0].url).toBe(
      'data:image/png;base64,AAAA'
    )
    expect(ui[0].experimental_attachments?.[0].contentType).toBe('image/png')
  })

  it('does not add attachments to plain text messages', () => {
    const stored: ExtendedCoreMessage[] = [
      { role: 'user', content: 'just text' }
    ]
    const ui = convertToUIMessages(stored)
    expect(ui[0].experimental_attachments).toBeUndefined()
  })
})

describe('truncateMessages (image parts)', () => {
  it('does not let a large image data URL evict surrounding text', () => {
    // ~1MB base64 data URL: under the old logic this counted as ~1M "tokens"
    // and would blow the entire budget.
    const bigImage = 'data:image/png;base64,' + 'A'.repeat(1_000_000)

    const messages: CoreMessage[] = [
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'look at this image' },
          { type: 'image', image: bigImage }
        ] as any
      }
    ]

    const result = truncateMessages(messages, 5_000)
    // All three messages fit comfortably because the image is charged a flat,
    // small estimate rather than its full base64 length.
    expect(result).toHaveLength(3)
    expect(result[0].role).toBe('user')
  })
})
