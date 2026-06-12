import { researcher } from '@/lib/agents/researcher'
import {
    convertToCoreMessages,
    CoreMessage,
    createDataStreamResponse,
    DataStreamWriter,
    streamText
} from 'ai'
import { getMaxAllowedTokens, truncateMessages } from '../utils/context-window'
import { isReasoningModel } from '../utils/registry'
import { handleStreamError, handleStreamFinish } from './handle-stream-finish'
import { BaseStreamConfig } from './types'

// Function to check if a message contains ask_question tool invocation
function containsAskQuestionTool(message: CoreMessage) {
  // For CoreMessage format, we check the content array
  if (message.role !== 'assistant' || !Array.isArray(message.content)) {
    return false
  }

  // Check if any content item is a tool-call with ask_question tool
  return message.content.some(
    item => item.type === 'tool-call' && item.toolName === 'ask_question'
  )
}

export function createToolCallingStreamResponse(config: BaseStreamConfig) {
  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      const { messages, model, chatId, searchMode, userId } = config
      const modelId = `${model.providerId}:${model.id}`

      // Track partial text for error handling
      let accumulatedText = ''

      try {
        const coreMessages = convertToCoreMessages(messages)
        const truncatedMessages = truncateMessages(
          coreMessages,
          getMaxAllowedTokens(model)
        )

        let researcherConfig = await researcher({
          messages: truncatedMessages,
          model: modelId,
          searchMode
        })

        const result = streamText({
          ...researcherConfig,
          onFinish: async result => {
            // Check if the last message contains an ask_question tool invocation
            const shouldSkipRelatedQuestions =
              isReasoningModel(modelId) ||
              (result.response.messages.length > 0 &&
                containsAskQuestionTool(
                  result.response.messages[
                    result.response.messages.length - 1
                  ] as CoreMessage
                ))

            await handleStreamFinish({
              responseMessages: result.response.messages,
              originalMessages: messages,
              model: modelId,
              chatId,
              dataStream,
              userId,
              skipRelatedQuestions: shouldSkipRelatedQuestions,
              skipSaveHistory: config.skipSaveHistory
            })
          },
          onChunk: event => {
            // Capture text deltas for error handling
            if (event.chunk?.type === 'text-delta') {
              accumulatedText += event.chunk.textDelta
            }
          }
        })

        result.mergeIntoDataStream(dataStream)
      } catch (error) {
        console.error('Stream execution error:', error)
        
        // Save partial response on error
        await handleStreamError({
          originalMessages: messages,
          partialResponse: accumulatedText,
          error: error instanceof Error ? error : new Error(String(error)),
          chatId,
          userId,
          context: 'Stream execution error',
          skipSaveHistory: config.skipSaveHistory
        })
        
        throw error
      }
    },
    onError: error => {
      console.error('Stream error:', error)
      
      // Save partial response on error (fire and forget)
      handleStreamError({
        originalMessages: config.messages,
        error: error instanceof Error ? error : new Error(String(error)),
        chatId: config.chatId,
        userId: config.userId,
        context: 'Stream onError callback',
        skipSaveHistory: config.skipSaveHistory
      }).catch(saveError => {
        console.error('Failed to save partial response on stream error:', saveError)
      })
      
      return error instanceof Error ? error.message : String(error)
    }
  })
}
