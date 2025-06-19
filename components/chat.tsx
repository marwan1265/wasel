'use client'

import { useEnhancedChat as useChat } from '@/hooks/use-enhanced-chat'
import { useIsSharePage } from '@/hooks/use-is-share-page'
import { CHAT_ID } from '@/lib/constants'
import { useAutoScroll } from '@/lib/hooks/use-auto-scroll'
import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import { getCookie } from '@/lib/utils/cookies'
import { ChatRequestOptions } from 'ai'
import { Message } from 'ai/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
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
  const [isSearchMode, setIsSearchMode] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const updateTimeoutRef = useRef<NodeJS.Timeout>()
  const isSharePage = useIsSharePage()
  
  // Track if a response is currently being generated
  const isGeneratingRef = useRef(false)
  // Track partial response text for manual stops
  const partialResponseRef = useRef<string>('')

  const chatHookResult = useChat({
    initialMessages: savedMessages,
    id: CHAT_ID,
    api: isSharePage ? '/api/chat/ephemeral' : '/api/chat', // Use ephemeral API for share pages
    body: {
      id
    },
    onFinish: (message: any) => {
      // Response completed normally
      console.log('[onFinish] Response completed normally')
      isGeneratingRef.current = false
      partialResponseRef.current = ''
    },
    onError: (error: any) => {
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
      // Only if not on share page
      if (!isSharePage) {
        handleUrlAndHistoryUpdate()
      }
    },
    sendExtraMessageFields: false
    // Note: experimental_throttle removed as it may not be available in current version
  })

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
    reload
  } = chatHookResult

  // Safely access addToolResult if it exists
  const addToolResult = (chatHookResult as any).addToolResult

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
    // Restore search mode from cookies
    const savedMode = getCookie('search-mode')
    if (savedMode !== null) {
      setIsSearchMode(savedMode === 'true')
    }
  }, [])

  useEffect(() => {
    setMessages(savedMessages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Debounced function to handle URL change and history update
  const handleUrlAndHistoryUpdate = useCallback(() => {
    // Skip URL and history updates on share pages
    if (isSharePage) {
      return
    }
    
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
  }, [id, isSharePage])

  // Function to save partial response for manual stops
  const savePartialResponse = useCallback(async (partialText: string, reason: string = 'user_stopped') => {
    // Skip saving on share pages
    if (isSharePage || !partialText.trim()) return

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
  }, [id, messages, handleUrlAndHistoryUpdate, isSharePage])

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
    
    // Only save partial responses if not on share page
    if (!isSharePage) {
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
    }
  }, [originalStop, savePartialResponse, handleUrlAndHistoryUpdate, isSharePage])

  // Page cleanup - save partial response if user navigates away during generation
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Skip saving on share pages
      if (isSharePage || !isGeneratingRef.current || !partialResponseRef.current.trim()) {
        return
      }
      
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

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [id, messages, isSharePage])

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
    // Only update URL/history if not on share page
    if (!isSharePage) {
      handleUrlAndHistoryUpdate()
    }
  }

  // Wrapped append function that also handles URL and history updates
  const appendWithUrlUpdate = (message: any) => {
    append(message)
    // Only update URL/history if not on share page
    if (!isSharePage) {
      handleUrlAndHistoryUpdate()
    }
  }

  // Custom submit handler that changes URL and updates history immediately
  const handleSubmit = (
    event?: React.FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions
  ) => {
    // First, call the original submit handler to start the chat
    originalHandleSubmit(event, options)
    
    // Handle URL and history update with slight delay (only if not on share page)
    if (!isSharePage) {
      handleUrlAndHistoryUpdate()
    }
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

  // Show toast notification for share pages instead of banner
  useEffect(() => {
    if (isSharePage) {
      toast.info('أنت تشاهد محادثة مشتركة', {
        description: 'يمكنك متابعة المحادثة، لكن رسائلك لن يتم حفظها أو مشاركتها.',
        duration: 6000,
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        )
      })
    }
  }, [isSharePage])

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
        isSearchMode={isSearchMode}
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
        reload={handleReloadFrom}
        isGenerating={isGeneratingRef.current}
        isSearchMode={isSearchMode}
        onSearchModeChange={setIsSearchMode}
      />
    </div>
  )
}
