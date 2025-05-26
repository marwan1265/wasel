import { getChat, saveChat } from '@/lib/actions/chat'
import { generateRelatedQuestions } from '@/lib/agents/generate-related-questions'
import { Chat, ExtendedCoreMessage } from '@/lib/types'
import { convertToExtendedCoreMessages } from '@/lib/utils'
import { CoreMessage, DataStreamWriter, JSONValue, Message } from 'ai'

interface HandleStreamFinishParams {
  responseMessages: CoreMessage[]
  originalMessages: Message[]
  model: string
  chatId: string
  dataStream: DataStreamWriter
  userId: string
  skipRelatedQuestions?: boolean
  annotations?: ExtendedCoreMessage[]
}

// New function to handle partial saves on error/timeout
export async function handleStreamError({
  originalMessages,
  partialResponse,
  error,
  chatId,
  userId,
  context
}: {
  originalMessages: Message[]
  partialResponse?: string
  error: Error
  chatId: string
  userId: string
  context?: string // Additional context about the error
}): Promise<void> {
  try {
    console.log('[handleStreamError] Handling stream error for chatId:', chatId, 'Error:', error.message)

    if (process.env.ENABLE_SAVE_CHAT_HISTORY !== 'true') {
      return
    }

    const extendedCoreMessages = convertToExtendedCoreMessages(originalMessages)
    
    // Get existing chat or create fallback
    let savedChat = await getChat(chatId, userId)
    if (!savedChat) {
      console.log('[handleStreamError] No existing chat found, creating new one for chatId:', chatId)
      savedChat = {
        messages: [],
        createdAt: new Date(),
        userId: userId,
        path: `/search/${chatId}`,
        title: originalMessages[0]?.content?.toString() || 'New Chat',
        id: chatId
      }
    }

    // Create messages array with partial response if available
    let messagesToSave = [...extendedCoreMessages]
    
    // Determine what kind of error response to save
    let errorContent = ''
    
    if (partialResponse && partialResponse.trim()) {
      // If we have partial response, save it with a note about incompleteness
      errorContent = partialResponse.trim()
      
      // Add appropriate suffix based on error type
      if (error.message.toLowerCase().includes('timeout')) {
        errorContent += '\n\n_[Response was cut off due to timeout]_'
      } else if (error.message.toLowerCase().includes('network')) {
        errorContent += '\n\n_[Response was interrupted due to network error]_'
      } else {
        errorContent += '\n\n_[Response was incomplete due to an error]_'
      }
    } else {
      // No partial response - save a helpful error message based on error type
      if (error.message.toLowerCase().includes('timeout')) {
        errorContent = '_The response timed out before completion. Please try again with a shorter request or simpler question._'
      } else if (error.message.toLowerCase().includes('network')) {
        errorContent = '_Network connection was interrupted. Please check your connection and try again._'
      } else if (error.message.toLowerCase().includes('rate limit')) {
        errorContent = '_Rate limit exceeded. Please wait a moment before trying again._'
      } else {
        errorContent = `_An error occurred: ${error.message}. Please try again._`
      }
    }

    // Add the assistant message with error content
    messagesToSave.push({
      role: 'assistant',
      content: errorContent
    })

    const finalChat: Chat = {
      ...savedChat,
      messages: messagesToSave,
      title: savedChat.title === 'New Chat' && originalMessages[0]?.content 
        ? originalMessages[0].content.toString() 
        : savedChat.title
    }

    await saveChat(finalChat, userId).catch(saveError => {
      console.error('[handleStreamError] Failed to save partial chat:', saveError)
    })

    console.log('[handleStreamError] Successfully saved partial chat for chatId:', chatId)
  } catch (error) {
    console.error('[handleStreamError] Error saving partial response:', error)
    // Don't throw - this is error handling, we don't want to fail the error handler
  }
}

export async function handleStreamFinish({
  responseMessages,
  originalMessages,
  model,
  chatId,
  dataStream,
  userId,
  skipRelatedQuestions = false,
  annotations = []
}: HandleStreamFinishParams) {
  try {
    const extendedCoreMessages = convertToExtendedCoreMessages(originalMessages)
    let allAnnotations = [...annotations]

    if (!skipRelatedQuestions) {
      // Notify related questions loading
      const relatedQuestionsAnnotation: JSONValue = {
        type: 'related-questions',
        data: { items: [] }
      }
      dataStream.writeMessageAnnotation(relatedQuestionsAnnotation)

      // Generate related questions
      const relatedQuestions = await generateRelatedQuestions(
        responseMessages,
        model
      )

      // Create and add related questions annotation
      const updatedRelatedQuestionsAnnotation: ExtendedCoreMessage = {
        role: 'data',
        content: {
          type: 'related-questions',
          data: relatedQuestions.object
        } as JSONValue
      }

      dataStream.writeMessageAnnotation(
        updatedRelatedQuestionsAnnotation.content as JSONValue
      )
      allAnnotations.push(updatedRelatedQuestionsAnnotation)
    }

    // Create the complete message set to save
    const generatedMessages = [
      ...extendedCoreMessages,
      ...responseMessages.slice(0, -1),
      ...allAnnotations, // Add annotations before the last message
      ...responseMessages.slice(-1)
    ] as ExtendedCoreMessage[]

    if (process.env.ENABLE_SAVE_CHAT_HISTORY !== 'true') {
      return
    }

    console.log('[handleStreamFinish] Starting final chat save for chatId:', chatId)

    // Get the existing chat (which might have been created by early save) or create a new one
    let savedChat = await getChat(chatId, userId)
    
    if (!savedChat) {
      console.log('[handleStreamFinish] No existing chat found, creating new one for chatId:', chatId)
      // Fallback: create new chat if early save failed
      savedChat = {
        messages: [],
        createdAt: new Date(),
        userId: userId,
        path: `/search/${chatId}`,
        title: originalMessages[0]?.content?.toString() || 'New Chat',
        id: chatId
      }
    } else {
      console.log('[handleStreamFinish] Found existing chat for chatId:', chatId, 'with', savedChat.messages.length, 'existing messages')
    }

    // Create the final chat with complete conversation
    const finalChat: Chat = {
      ...savedChat,
      messages: generatedMessages,
      // Update title if it's still default and we have a better one
      title: savedChat.title === 'New Chat' && originalMessages[0]?.content 
        ? originalMessages[0].content.toString() 
        : savedChat.title
    }

    // Save complete chat with all messages (deduplication handled in saveChat)
    await saveChat(finalChat, userId).catch(error => {
      console.error('[handleStreamFinish] Failed to save final chat:', error)
      throw new Error('Failed to save chat history')
    })

    console.log('[handleStreamFinish] Successfully completed final save for chatId:', chatId)
  } catch (error) {
    console.error('[handleStreamFinish] Error in handleStreamFinish:', error)
    throw error
  }
}
