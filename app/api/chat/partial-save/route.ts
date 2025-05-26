import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { handleStreamError } from '@/lib/streaming/handle-stream-finish'
import { Message } from 'ai'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const { chatId, messages, partialResponse, reason } = await req.json()
    
    if (!chatId || !messages || !Array.isArray(messages)) {
      return new Response('Invalid request data', {
        status: 400,
        statusText: 'Bad Request'
      })
    }

    const userId = await getCurrentUserId()
    
    console.log('[partial-save] Handling partial save for chatId:', chatId, 'reason:', reason)

    // Use the existing handleStreamError function to save partial responses
    const error = new Error(getErrorMessageForReason(reason))
    
    await handleStreamError({
      originalMessages: messages as Message[],
      partialResponse: partialResponse || '',
      error,
      chatId,
      userId,
      context: `Partial save due to: ${reason}`
    })

    console.log('[partial-save] Successfully saved partial response for chatId:', chatId)
    
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('[partial-save] Error saving partial response:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to save partial response',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

function getErrorMessageForReason(reason: string): string {
  switch (reason) {
    case 'user_stopped':
      return 'Response stopped by user'
    case 'page_unload':
      return 'Page was closed during response'
    case 'navigation':
      return 'User navigated away during response'
    case 'edge_function_timeout':
      return 'Response exceeded time limit'
    case 'proactive_save':
      return 'Long-running response (auto-saved)'
    case 'network_timeout':
      return 'Network timeout occurred'
    default:
      return 'Response was interrupted'
  }
} 