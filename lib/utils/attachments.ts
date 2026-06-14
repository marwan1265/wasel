import { Model } from '@/lib/types/models'
import { Message } from 'ai'

/**
 * Image/file attachment support (multimodal queries).
 *
 * This module is the single source of truth for attachment limits and for the
 * server-side sanitisation that protects the model/provider from unsupported or
 * oversized inputs. It is intentionally dependency-free so it can run on the
 * Edge runtime (the chat routes) as well as in the browser and in tests.
 */

/** Image MIME types accepted as attachments. */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
] as const

/** Value for an <input type="file" accept="..."> attribute. */
export const ACCEPTED_IMAGE_TYPES_ATTR = ACCEPTED_IMAGE_TYPES.join(',')

/** Maximum number of attachments per message. */
export const MAX_ATTACHMENTS = 5

/** Maximum decoded size of a single attachment (5 MB). */
export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024

export interface AttachmentLike {
  name?: string
  contentType?: string
  url: string
}

/** Whether the given model can accept image inputs. */
export function modelSupportsVision(
  model?: Pick<Model, 'vision'> | null
): boolean {
  return !!model?.vision
}

/** Whether a MIME type is an accepted image type. */
export function isAcceptedImageType(type?: string | null): boolean {
  return !!type && (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type)
}

/** Extract the MIME type from a `data:` URL, if present. */
export function contentTypeFromDataUrl(url: string): string | undefined {
  if (!url.startsWith('data:')) return undefined
  const commaIndex = url.indexOf(',')
  if (commaIndex === -1) return undefined
  const meta = url.slice(5, commaIndex).split(';')[0]
  return meta || undefined
}

/**
 * Estimate the decoded byte size of a `data:` URL without allocating a buffer
 * (important on the Edge runtime where we want to stay cheap).
 */
export function dataUrlByteSize(url: string): number {
  if (!url.startsWith('data:')) return 0
  const commaIndex = url.indexOf(',')
  if (commaIndex === -1) return 0
  const meta = url.slice(5, commaIndex)
  const data = url.slice(commaIndex + 1)
  if (meta.includes(';base64')) {
    const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0
    return Math.max(0, Math.floor((data.length * 3) / 4) - padding)
  }
  try {
    return decodeURIComponent(data).length
  } catch {
    return data.length
  }
}

export interface SanitizeResult {
  messages: Message[]
  /** True if attachments were dropped because the model lacks vision support. */
  removedForModel: boolean
  /** Count of attachments dropped for failing type/size/count validation. */
  rejected: number
}

/**
 * Validate and, where necessary, strip image attachments from a list of UI
 * messages before they are handed to the model.
 *
 * - If the model has no vision support, every `experimental_attachments` array
 *   is removed so a text-only provider can never receive image parts.
 * - For vision models, attachments are filtered to the accepted image types,
 *   the per-file size limit, and the per-message count limit.
 *
 * The input messages are never mutated; new objects are returned where changes
 * are required and the originals are passed through untouched otherwise.
 */
export function sanitizeAttachments(
  messages: Message[] | undefined | null,
  model: Pick<Model, 'vision'> | null | undefined
): SanitizeResult {
  const visionOk = modelSupportsVision(model)
  let removedForModel = false
  let rejected = 0

  const sanitized = (messages ?? []).map(message => {
    const attachments = (message as { experimental_attachments?: AttachmentLike[] })
      .experimental_attachments

    if (!attachments || attachments.length === 0) {
      return message
    }

    // Model can't see images: drop all attachments.
    if (!visionOk) {
      removedForModel = true
      const { experimental_attachments, ...rest } = message as Message & {
        experimental_attachments?: AttachmentLike[]
      }
      return rest as Message
    }

    const valid: AttachmentLike[] = []
    for (const attachment of attachments) {
      if (valid.length >= MAX_ATTACHMENTS) {
        rejected++
        continue
      }
      const url = attachment?.url
      if (!url || typeof url !== 'string') {
        rejected++
        continue
      }
      const contentType = attachment.contentType || contentTypeFromDataUrl(url)
      if (!isAcceptedImageType(contentType)) {
        rejected++
        continue
      }
      if (
        url.startsWith('data:') &&
        dataUrlByteSize(url) > MAX_ATTACHMENT_SIZE_BYTES
      ) {
        rejected++
        continue
      }
      valid.push({ ...attachment, contentType })
    }

    if (valid.length === 0) {
      const { experimental_attachments, ...rest } = message as Message & {
        experimental_attachments?: AttachmentLike[]
      }
      return rest as Message
    }
    // Always return the normalised list (with contentType guaranteed). The AI
    // SDK throws on a data: URL attachment that has no contentType, so we must
    // never pass one through un-normalised.
    return {
      ...(message as Message),
      experimental_attachments: valid
    } as Message
  })

  return { messages: sanitized, removedForModel, rejected }
}
