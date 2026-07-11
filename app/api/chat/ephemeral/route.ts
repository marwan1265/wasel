import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { createManualToolStreamResponse } from '@/lib/streaming/create-manual-tool-stream'
import { createToolCallingStreamResponse } from '@/lib/streaming/create-tool-calling-stream'
import { Model } from '@/lib/types/models'
import { sanitizeAttachments } from '@/lib/utils/attachments'
import { isProviderEnabled } from '@/lib/utils/registry'
import { cookies } from 'next/headers'

export const runtime = 'edge'

const DEFAULT_MODEL: Model = {
  id: 'deepseek-chat',
  name: 'DeepSeek V3',
  provider: 'DeepSeek',
  providerId: 'deepseek',
  enabled: true,
  toolCallType: 'manual'
}

export async function POST(req: Request) {
  try {
    const { messages: rawMessages, id: chatId } = await req.json()

    // Note: This endpoint does NOT save messages to the database
    // It's designed for ephemeral conversations on shared pages
    
    console.log('[Ephemeral API] Processing ephemeral chat request for:', chatId)

    // Get the current user ID (this will be set by middleware)
    // For authenticated users: their actual user ID
    // For guest users: 'anonymous' 
    // For unauthorized users: middleware will have already blocked the request
    const userId = await getCurrentUserId()
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    console.log('[Ephemeral API] Authenticated user:', userId)

    const cookieStore = await cookies()
    const modelJson = cookieStore.get('selectedModel')?.value
    const searchMode = cookieStore.get('search-mode')?.value === 'true'

    let selectedModel = DEFAULT_MODEL

    if (modelJson) {
      try {
        selectedModel = JSON.parse(modelJson) as Model
      } catch (e) {
        console.error('Failed to parse selected model:', e)
      }
    }

    if (
      !isProviderEnabled(selectedModel.providerId) ||
      selectedModel.enabled === false
    ) {
      return new Response(
        `Selected provider is not enabled ${selectedModel.providerId}`,
        {
          status: 404,
          statusText: 'Not Found'
        }
      )
    }

    console.log(`[Ephemeral API] Using model: ${selectedModel.name} (${selectedModel.providerId})`)

    // Strip image attachments for text-only models and drop invalid/oversized files.
    const { messages } = sanitizeAttachments(rawMessages, selectedModel)

    const supportsToolCalling = selectedModel.toolCallType === 'native'

    // Use the same streaming logic as main chat API
    // Rate limiting and authentication are handled by middleware
    return supportsToolCalling
      ? createToolCallingStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode,
          userId,
          skipSaveHistory: true
        })
      : createManualToolStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode,
          userId,
          skipSaveHistory: true
        })
  } catch (error) {
    console.error('[Ephemeral API] Error in ephemeral chat:', error)
    return new Response('An error occurred while processing your request.', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
} 