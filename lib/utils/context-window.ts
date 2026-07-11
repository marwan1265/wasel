import { CoreMessage } from 'ai'
import { Model } from '../types/models'

const DEFAULT_CONTEXT_WINDOW = 128_000
const DEFAULT_RESERVE_TOKENS = 30_000

export function getMaxAllowedTokens(model: Model): number {
  let contextWindow: number
  let reserveTokens: number

  if (model.id.includes('deepseek')) {
    contextWindow = 64_000
    reserveTokens = 27_000
  } else if (model.id.includes('claude')) {
    contextWindow = 200_000
    reserveTokens = 40_000
  } else {
    contextWindow = DEFAULT_CONTEXT_WINDOW
    reserveTokens = DEFAULT_RESERVE_TOKENS
  }

  return contextWindow - reserveTokens
}

// Approximate character-cost charged for a single image/file part. Counting the
// raw base64 of a data URL (often megabytes) would make a single image dwarf the
// whole budget and evict all surrounding context, so we charge a flat estimate.
const IMAGE_PART_SIZE_ESTIMATE = 2_000

// Estimate message size in characters. For array content (tool calls/results,
// multimodal parts), `content.length` is the number of parts — not the size —
// which let huge tool results slip past truncation untouched.
function estimateMessageSize(message: CoreMessage): number {
  if (typeof message.content === 'string') {
    return message.content.length
  }
  if (Array.isArray(message.content)) {
    let size = 0
    for (const part of message.content as Array<{ type?: string }>) {
      if (part && (part.type === 'image' || part.type === 'file')) {
        size += IMAGE_PART_SIZE_ESTIMATE
        continue
      }
      try {
        size += JSON.stringify(part)?.length || 0
      } catch {
        // Ignore parts that can't be stringified.
      }
    }
    return size
  }
  try {
    return JSON.stringify(message.content)?.length || 0
  } catch {
    return 0
  }
}

export function truncateMessages(
  messages: CoreMessage[],
  maxTokens: number
): CoreMessage[] {
  let totalTokens = 0
  const tempMessages: CoreMessage[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    const messageTokens = estimateMessageSize(message)

    if (totalTokens + messageTokens <= maxTokens) {
      tempMessages.push(message)
      totalTokens += messageTokens
    } else {
      break
    }
  }

  const orderedMessages = tempMessages.reverse()

  while (orderedMessages.length > 0 && orderedMessages[0].role !== 'user') {
    orderedMessages.shift()
  }

  // Never return an empty list (the provider rejects empty message arrays):
  // fall back to the most recent user message even if it exceeds the budget.
  if (orderedMessages.length === 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return [messages[i]]
      }
    }
  }

  return orderedMessages
}
