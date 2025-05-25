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
