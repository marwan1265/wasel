'use client'

import { CHAT_ID } from '@/lib/constants'
import { useAutoScroll } from '@/lib/hooks/use-auto-scroll'
import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { ChatRequestOptions } from 'ai'
import { Message } from 'ai/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'
import { showRateLimitToast } from './rate-limit-error'

export function Chat({
  id,
  savedMessages = [],
  query,
  models
}: {
  id: string
  savedMessages?: Message[]
  query?: string
  models?: Model[]
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const updateTimeoutRef = useRef<NodeJS.Timeout>()
  
  // Track if a response is currently being generated
  const isGeneratingRef = useRef(false)
  // Track partial response text for manual stops
  const partialResponseRef = useRef<string>('')

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    status,
    setMessages,
    stop: originalStop,
    append,
    data,
    setData,
    addToolResult,
    reload
  } = useChat({
    initialMessages: savedMessages,
    id: CHAT_ID,
    body: {
      id
    },
    onFinish: (message) => {
      // Response completed normally
      console.log('[onFinish] Response completed normally')
      isGeneratingRef.current = false
      partialResponseRef.current = ''
    },
    onError: error => {
      console.error('[onError] Chat error:', error)
      isGeneratingRef.current = false
      partialResponseRef.current = ''
      
      // Check if this is a rate limit error (429 status)
      const isRateLimitError = error.message.includes('429') || 
                              error.message.toLowerCase().includes('rate limit') ||
                              error.message.toLowerCase().includes('too many requests')
      
      if (isRateLimitError) {
        // Try to parse additional error details from the error message
        try {
          // The error message might contain JSON with additional details
          const jsonMatch = error.message.match(/\{.*\}/)
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0])
            showRateLimitToast({
              reason: errorData.reason,
              timeRemaining: errorData.timeRemaining,
              canSignIn: errorData.canSignIn,
              upgradeAction: errorData.upgradeAction
            })
          } else {
            // Fallback to generic rate limit toast
            showRateLimitToast({
              reason: 'time_window_limit',
              canSignIn: true
            })
          }
        } catch {
          // If parsing fails, show generic rate limit error
          showRateLimitToast({
            reason: 'time_window_limit',
            canSignIn: true
          })
        }
      } else {
        // Show generic error for non-rate-limit errors
        toast.error(`Error in chat: ${error.message}`)
      }
      
      // Update chat history so the failed chat appears in sidebar
      handleUrlAndHistoryUpdate()
    },
    sendExtraMessageFields: false,
    experimental_throttle: 100
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Update partial response tracking and generation state
  useEffect(() => {
    if (isLoading) {
      // Mark as generating when loading starts
      if (!isGeneratingRef.current) {
        isGeneratingRef.current = true
        partialResponseRef.current = ''
      }
      
      // Update partial response text as messages come in
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.role === 'assistant') {
          partialResponseRef.current = lastMessage.content || ''
        }
      }
    } else {
      // Reset when loading ends (natural completion)
      if (isGeneratingRef.current) {
        isGeneratingRef.current = false
        partialResponseRef.current = ''
      }
    }
  }, [messages, isLoading])

  const {
    anchorRef,
    isAutoScroll,
    enable: enableAutoScroll
  } = useAutoScroll({
    isLoading,
    dependency: messages.length,
    isStreaming: status === 'streaming',
    scrollContainer: scrollContainerRef,
    threshold: 70
  })

  useEffect(() => {
    setMessages(savedMessages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Debounced function to handle URL change and history update
  const handleUrlAndHistoryUpdate = useCallback(() => {
    // Clear any existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    // Delay the update slightly to allow API request to start
    updateTimeoutRef.current = setTimeout(() => {
      const currentPath = window.location.pathname
      if (currentPath !== `/search/${id}`) {
        window.history.replaceState({}, '', `/search/${id}`)
      }
      
      // Dispatch the event
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    }, 100)
  }, [id])

  // Function to save partial response for manual stops
  const savePartialResponse = useCallback(async (partialText: string, reason: string = 'user_stopped') => {
    if (!partialText.trim()) return

    try {
      console.log(`[savePartialResponse] Saving partial response due to: ${reason}`)
      
      // Call our partial save endpoint
      const response = await fetch('/api/chat/partial-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: id,
          messages: messages,
          partialResponse: partialText,
          reason: reason
        }),
      })

      if (!response.ok) {
        console.error('[savePartialResponse] Failed to save partial response:', response.statusText)
      } else {
        console.log('[savePartialResponse] Successfully saved partial response')
        // Update chat history after successful save
        handleUrlAndHistoryUpdate()
      }
    } catch (error) {
      console.error('[savePartialResponse] Error saving partial response:', error)
    }
  }, [id, messages, handleUrlAndHistoryUpdate])

  // Enhanced stop function that saves partial responses
  const stop = useCallback(() => {
    console.log('[stop] User manually stopped response')
    
    const wasGenerating = isGeneratingRef.current
    const partialText = partialResponseRef.current
    
    // Reset tracking
    isGeneratingRef.current = false
    partialResponseRef.current = ''
    
    // Call original stop function
    originalStop()
    
    // If we were generating and have partial text, save it
    if (wasGenerating && partialText.trim()) {
      // Save partial response (fire and forget)
      savePartialResponse(partialText, 'user_stopped').catch(error => {
        console.error('[stop] Failed to save partial response:', error)
      })
    } else if (wasGenerating) {
      // Even if no partial text, update history so the stopped chat appears
      console.log('[stop] No partial response but updating history for stopped chat')
      handleUrlAndHistoryUpdate()
    }
  }, [originalStop, savePartialResponse, handleUrlAndHistoryUpdate])

  // Page cleanup - save partial response if user navigates away during generation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isGeneratingRef.current && partialResponseRef.current.trim()) {
        // Use navigator.sendBeacon for reliable cleanup during page unload
        const payload = JSON.stringify({
          chatId: id,
          messages: messages,
          partialResponse: partialResponseRef.current,
          reason: 'page_unload'
        })
        
        try {
          navigator.sendBeacon('/api/chat/partial-save', payload)
        } catch (error) {
          console.error('[beforeunload] Failed to save partial response:', error)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [id, messages])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  const onQuerySelect = (query: string) => {
    append({
      role: 'user',
      content: query
    })
    handleUrlAndHistoryUpdate()
  }

  // Wrapped append function that also handles URL and history updates
  const appendWithUrlUpdate = (message: any) => {
    append(message)
    handleUrlAndHistoryUpdate()
  }

  // Custom submit handler that changes URL and updates history immediately
  const handleSubmit = (
    event?: React.FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions
  ) => {
    // First, call the original submit handler to start the chat
    originalHandleSubmit(event, options)
    
    // Handle URL and history update with slight delay
    handleUrlAndHistoryUpdate()
  }

  // For regeneration and other operations
  const handleUpdateAndReloadMessage = async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId)
    if (messageIndex === -1) return

    const updatedMessages = [...messages]
    updatedMessages[messageIndex].content = newContent
    setMessages(updatedMessages)
  }

  const handleReloadFrom = async (
    messageId: string,
    options?: ChatRequestOptions
  ) => {
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      const userMessageIndex = messages
        .slice(0, messageIndex)
        .findLastIndex(m => m.role === 'user')
      if (userMessageIndex !== -1) {
        const trimmedMessages = messages.slice(0, userMessageIndex + 1)
        setMessages(trimmedMessages)
        return await reload(options)
      }
    }
    return await reload(options)
  }

  // Main render with custom onSubmit
  const onSubmit = (
    event?: React.FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions
  ) => {
    handleSubmit(event, options)
  }

  return (
    <div
      className={cn(
        'relative flex h-full flex-1 flex-col overflow-hidden',
        'max-h-screen max-h-screen-dynamic', // Ensure it doesn't exceed viewport
        messages.length === 0 ? 'items-center justify-center pt-16 md:pt-0' : ''
      )}
      data-testid="full-chat"
    >
      <ChatMessages
        messages={messages}
        data={data}
        onQuerySelect={onQuerySelect}
        isLoading={isLoading}
        chatId={id}
        addToolResult={addToolResult}
        anchorRef={anchorRef}
        scrollContainerRef={scrollContainerRef}
        onUpdateMessage={handleUpdateAndReloadMessage}
        reload={handleReloadFrom}
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={onSubmit}
        isLoading={isLoading}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
        query={query}
        append={appendWithUrlUpdate}
        models={models}
        isAutoScroll={isAutoScroll}
      />
    </div>
  )
}
