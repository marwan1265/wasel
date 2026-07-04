import { useAuthContext } from '@/lib/contexts/auth-context'
import { useChat, UseChatHelpers, UseChatOptions } from '@ai-sdk/react'
import { ChatRequestOptions } from 'ai'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface QueuedMessage {
  id: string
  content: string
  options?: ChatRequestOptions
  timestamp: number
}

export function useEnhancedChat(
  options: UseChatOptions
): UseChatHelpers & { hasQueuedMessages: boolean } {
  const { isAuthReady, isAuthPending, isAuthSuccessful, authError } = useAuthContext()
  const chatHook = useChat(options)
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([])
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const queueIdCounter = useRef(0)
  const { input, setInput, handleSubmit: originalHandleSubmit, append } = chatHook

  // Process the queue when auth becomes ready AND successful
  useEffect(() => {
    if (isAuthReady && isAuthSuccessful && !isProcessingQueue && messageQueue.length > 0) {
      setIsProcessingQueue(true)
      
      // Process messages in order
      const processQueue = async () => {
        // Snapshot what we process so messages queued *while* processing are
        // not wiped by the cleanup below (they'd be silently lost).
        const toProcess = [...messageQueue]
        console.log(`Processing ${toProcess.length} queued messages`)

        for (const queuedMessage of toProcess) {
          try {
            // Use append to add the user message directly
            await append({
              role: 'user',
              content: queuedMessage.content
            })

            // Small delay between messages
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (error) {
            console.error('Error processing queued message:', error)
            // Continue with next message even if one fails
          }
        }

        // Remove only the processed messages and stop processing
        const processedIds = new Set(toProcess.map(message => message.id))
        setMessageQueue(prev => prev.filter(message => !processedIds.has(message.id)))
        setIsProcessingQueue(false)
        console.log('Finished processing message queue')
      }

      processQueue()
    }
  }, [isAuthReady, isAuthSuccessful, messageQueue, isProcessingQueue, append])

  // Handle auth failure - show error and clear queue
  useEffect(() => {
    if (isAuthReady && !isAuthSuccessful && authError && messageQueue.length > 0) {
      console.error('Authentication failed, clearing message queue:', authError)
      
      // Show user-friendly error message
      toast.error(
        'Authentication failed. Please refresh the page to try again.',
        {
          description: authError,
          duration: 5000
        }
      )
      
      // Clear the queue since we can't process messages without auth
      setMessageQueue([])
      setIsProcessingQueue(false)
    }
  }, [isAuthReady, isAuthSuccessful, authError, messageQueue.length])

  // Enhanced submit handler
  const enhancedHandleSubmit = useCallback((
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions
  ) => {
    // Get the current input value when submitting
    const messageContent = input.trim()
    
    if (!messageContent) {
      // No content to send, let original handler deal with it
      originalHandleSubmit(event, chatRequestOptions)
      return
    }

    // If auth is ready and successful, send immediately
    if (isAuthReady && isAuthSuccessful && !isProcessingQueue) {
      originalHandleSubmit(event, chatRequestOptions)
      return
    }

    // If auth failed, show error and don't queue
    if (isAuthReady && !isAuthSuccessful) {
      toast.error(
        'Authentication required. Please refresh the page to try again.',
        {
          description: authError || 'Authentication failed',
          duration: 5000
        }
      )
      
      // Prevent the default form submission
      if (event?.preventDefault) {
        event.preventDefault()
      }
      return
    }

    // If auth is pending, queue the message
    if (isAuthPending || !isAuthReady) {
      const queuedMessage: QueuedMessage = {
        id: `queued-${queueIdCounter.current++}`,
        content: messageContent,
        options: chatRequestOptions,
        timestamp: Date.now()
      }
      
      setMessageQueue(prev => [...prev, queuedMessage])
      setInput('') // Clear input field so user knows the message was accepted
      
      // Prevent the default form submission since we're handling it
      if (event?.preventDefault) {
        event.preventDefault()
      }
      
      console.log('Message queued due to pending authentication:', messageContent)
      return
    }

    // Fallback: send immediately
    originalHandleSubmit(event, chatRequestOptions)
  }, [isAuthReady, isAuthSuccessful, isAuthPending, isProcessingQueue, originalHandleSubmit, input, setInput, authError])

  // Determine if we should show loading state
  const isLoadingEnhanced = chatHook.isLoading || 
                          (isAuthPending && messageQueue.length > 0) ||
                          isProcessingQueue

  // Return all original properties, but override handleSubmit and isLoading
  return {
    ...chatHook,
    handleSubmit: enhancedHandleSubmit,
    isLoading: isLoadingEnhanced,
    hasQueuedMessages: messageQueue.length > 0
  }
} 