'use client'

import { cn } from '@/lib/utils'
import { ChatRequestOptions, JSONValue, Message } from 'ai'
import { useEffect, useMemo, useState } from 'react'
import { ArabicSearchLoading } from './arabic-search-loading'
import { RenderMessage } from './render-message'
import { ToolSection } from './tool-section'
import { Spinner } from './ui/spinner'

interface ChatMessagesProps {
  messages: Message[]
  data: JSONValue[] | undefined
  onQuerySelect: (query: string) => void
  isLoading: boolean // True if status is 'submitted' or 'streaming'
  chatId?: string
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  /** Ref for anchoring auto-scroll position */
  anchorRef: React.RefObject<HTMLDivElement>
  /** Ref for the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement>
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
  reload?: (
    messageId: string,
    options?: ChatRequestOptions
  ) => Promise<string | null | undefined>
  /** Whether auto-scroll is enabled (used by the button, now removed) */
  // isAutoScroll?: boolean  // No longer needed
  /** Function to enable auto-scroll (used by the button, now removed) */
  // enableAutoScroll?: () => void // No longer needed
}

export function ChatMessages({
  messages,
  data,
  onQuerySelect,
  isLoading,
  chatId,
  addToolResult,
  anchorRef,
  scrollContainerRef,
  onUpdateMessage,
  reload
}: // isAutoScroll, // No longer needed
// enableAutoScroll // No longer needed
ChatMessagesProps) {
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})
  const manualToolCallId = 'manual-tool-call'

  // State for managing the 1-second delay visibility after primary loading stops
  const [delayedSpinnerActive, setDelayedSpinnerActive] = useState(false);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'user') {
      setOpenStates({ [manualToolCallId]: true })
    }
  }, [messages])

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (!isLoading) {
      setDelayedSpinnerActive(true);
      timerId = setTimeout(() => {
        setDelayedSpinnerActive(false);
      }, 1000);
    } else {
      setDelayedSpinnerActive(false);
    }
    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [isLoading]);

  // Extract last tool invocation (call state) from messages, if any
  const lastToolData = useMemo(() => {
    // Find last assistant message with parts containing tool-invocation
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role !== 'assistant') continue
      // @ts-ignore
      const parts: any[] | undefined = msg.parts
      if (!parts) continue
      // Find last tool invocation part without result (call state)
      for (let j = parts.length - 1; j >= 0; j--) {
        const part = parts[j]
        if (part.type === 'tool-invocation') {
          const tool = part.toolInvocation
          if (tool.toolName === 'search' && tool.state === 'call') {
            return tool
          }
        }
      }
    }
    return null
  }, [messages])

  if (!messages.length) return null

  // Determine if the generic spinner should be shown
  let shouldShowGenericSpinner = false;
  if (!lastToolData) { // This condition will now always be true
    const lastMessage = messages[messages.length - 1];
    if (isLoading) {
      if (lastMessage.role === 'user' || (lastMessage.role === 'assistant' && lastMessage.content === '')) {
        shouldShowGenericSpinner = true;
      }
    } else if (delayedSpinnerActive) {
      if (lastMessage.role === 'user' || (lastMessage.role === 'assistant' && lastMessage.content === '')) {
         shouldShowGenericSpinner = true;
      }
    }
  }

  const lastUserIndex =
    messages.length -
    1 -
    [...messages].reverse().findIndex(msg => msg.role === 'user')

  const getIsOpen = (id: string) => {
    if (id.includes('call')) {
      return openStates[id] ?? true
    }
    const baseId = id.endsWith('-related') ? id.slice(0, -8) : id
    const index = messages.findIndex(msg => msg.id === baseId)
    return openStates[id] ?? index >= lastUserIndex
  }

  const handleOpenChange = (id: string, open: boolean) => {
    setOpenStates(prev => ({
      ...prev,
      [id]: open
    }))
  }

  // Show ToolSection (which renders SearchSection) while an active search tool invocation is in progress
  const shouldShowToolSection = lastToolData !== null;

  return (
    <div
      id="scroll-container"
      ref={scrollContainerRef}
      role="list"
      aria-roledescription="chat messages"
      className={cn(
        'relative w-full pt-14',
        messages.length > 0 ? 'flex-1 overflow-y-auto max-h-screen-dynamic' : 'h-full'
      )}
    >
      <div className="relative mx-auto w-full max-w-3xl px-4">
        {messages.map(message => (
          <div key={message.id} className="mb-4 flex flex-col gap-4">
            <RenderMessage
              message={message}
              messageId={message.id}
              getIsOpen={getIsOpen}
              onOpenChange={handleOpenChange}
              onQuerySelect={onQuerySelect}
              chatId={chatId}
              addToolResult={addToolResult}
              onUpdateMessage={onUpdateMessage}
              reload={reload}
            />
          </div>
        ))}
        {shouldShowToolSection && lastToolData && (
          <ToolSection
            key={manualToolCallId}
            tool={lastToolData}
            isOpen={getIsOpen(manualToolCallId)}
            onOpenChange={open => handleOpenChange(manualToolCallId, open)}
            addToolResult={addToolResult}
          />
        )}
        {shouldShowGenericSpinner && (
          lastToolData ? <ArabicSearchLoading /> : <Spinner />
        )}
        <div ref={anchorRef} />
      </div>
      {/* Scroll to bottom button has been removed from here */}
    </div>
  )
}
