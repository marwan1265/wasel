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

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    status,
    setMessages,
    stop,
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
    onFinish: () => {
      // No longer handle URL change and history update here
      // This will still fire when the AI response completes
    },
    onError: error => {
      toast.error(`Error in chat: ${error.message}`)
    },
    sendExtraMessageFields: false, // Disable extra message fields,
    experimental_throttle: 100
  })

  const isLoading = status === 'submitted' || status === 'streaming'

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
  }, [id])

  // Cleanup timeouts when component unmounts or id changes
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
        updateTimeoutRef.current = undefined
      }
    }
  }, [id])

  // Debounced function to handle URL change and history update
  const handleUrlAndHistoryUpdate = useCallback(() => {
    // Clear any existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    // Update URL immediately
    updateTimeoutRef.current = setTimeout(() => {
      const currentPath = window.location.pathname
      if (currentPath !== `/search/${id}`) {
        window.history.replaceState({}, '', `/search/${id}`)
        console.log('[Chat] URL changed to:', `/search/${id}`)
      }
    }, 100)
  }, [id])

  // Separate function to trigger history update - called when we know the message is added
  const triggerHistoryUpdate = useCallback(() => {
    console.log('[Chat] Triggering history update with 1.5s delay')
    
    // Clear any existing timeout to prevent duplicates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      try {
        console.log('[Chat] Dispatching chat-history-updated event')
        window.dispatchEvent(new CustomEvent('chat-history-updated'))
      } catch (error) {
        console.error('[Chat] Error dispatching history update:', error)
      }
    }, 1500) // Give early save enough time
  }, [])

  const onQuerySelect = (query: string) => {
    append({
      role: 'user',
      content: query
    })
    handleUrlAndHistoryUpdate()
    triggerHistoryUpdate()
  }

  // Wrapped append function that also handles URL and history updates
  const appendWithUrlUpdate = (message: any) => {
    append(message)
    handleUrlAndHistoryUpdate()
    triggerHistoryUpdate()
  }

  // Custom submit handler that changes URL and updates history immediately
  const handleSubmit = (
    event?: React.FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions
  ) => {
    // First, call the original submit handler to start the chat
    originalHandleSubmit(event, options)
    
    // Handle URL change immediately and history update with delay
    handleUrlAndHistoryUpdate()
    triggerHistoryUpdate()
  }

  const handleUpdateAndReloadMessage = async (
    messageId: string,
    newContent: string
  ) => {
    setMessages(currentMessages =>
      currentMessages.map(msg =>
        msg.id === messageId ? { ...msg, content: newContent } : msg
      )
    )

    try {
      const messageIndex = messages.findIndex(msg => msg.id === messageId)
      if (messageIndex === -1) return

      const messagesUpToEdited = messages.slice(0, messageIndex + 1)

      setMessages(messagesUpToEdited)

      setData(undefined)

      await reload({
        body: {
          chatId: id,
          regenerate: true
        }
      })
    } catch (error) {
      console.error('Failed to reload after message update:', error)
      toast.error(`Failed to reload conversation: ${(error as Error).message}`)
    }
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

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setData(undefined)
    handleSubmit(e)
  }

  return (
    <div
      className={cn(
        'relative flex h-full min-w-0 flex-1 flex-col',
        messages.length === 0 ? 'items-center justify-center' : ''
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
