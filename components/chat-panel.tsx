'use client'

import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import { ChatRequestOptions, type Message } from 'ai'
import { ArrowUp, ChevronDown, Square } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'
import { useArtifact } from './artifact/artifact-context'
import { DeepthinkToggle } from './deepthink-toggle'
import { EmptyScreen } from './empty-screen'
import { ModelSelector } from './model-selector'
import { SearchModeToggle } from './search-mode-toggle'
import { Button } from './ui/button'
import { IconLogo } from './ui/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface ChatPanelProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  messages: Message[]
  setMessages: (messages: Message[]) => void
  query?: string
  stop: () => void
  append: (message: any) => void
  models?: Model[]
  /** Whether auto-scroll is currently active (at bottom) */
  isAutoScroll: boolean
  reload: (
    messageId: string,
    options?: ChatRequestOptions
  ) => Promise<string | null | undefined>
  isGenerating: boolean
  isSearchMode: boolean
  onSearchModeChange: (value: boolean) => void
}

export function ChatPanel({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  messages,
  setMessages,
  query,
  stop,
  append,
  models,
  isAutoScroll,
  reload,
  isGenerating,
  isSearchMode,
  onSearchModeChange
}: ChatPanelProps) {
  const [showEmptyScreen, setShowEmptyScreen] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false) // Composition state
  const [enterDisabled, setEnterDisabled] = useState(false) // Disable Enter after composition ends
  const { close: closeArtifact } = useArtifact()
  const [isMobile, setIsMobile] = useState(false)

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 300)
  }

  const handleNewChat = () => {
    setMessages([])
    closeArtifact()
    router.push('/')
  }

  const isToolInvocationInProgress = () => {
    if (!messages.length) return false

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant' || !lastMessage.parts) return false

    const parts = lastMessage.parts
    const lastPart = parts[parts.length - 1]

    return (
      lastPart?.type === 'tool-invocation' &&
      lastPart?.toolInvocation?.state === 'call'
    )
  }

  // if query is not empty, submit the query
  useEffect(() => {
    if (isFirstRender.current && query && query.trim().length > 0) {
      append({
        role: 'user',
        content: query
      })
      isFirstRender.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Add scroll to bottom handler
  const handleScrollToBottom = () => {
    const scrollContainer = document.getElementById('scroll-container')
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  const scrollButton = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="absolute -top-10 right-4 z-20 size-8 rounded-full shadow-md"
      onClick={handleScrollToBottom}
    >
      <ChevronDown size={16} />
    </Button>
  )

  const submitButton = (
    <Button
      type={isLoading ? 'button' : 'submit'}
      size={'icon'}
      variant={'outline'}
      className={cn(isLoading && 'animate-pulse', 'rounded-full hover:border-foreground')}
      disabled={
        (input.length === 0 && !isLoading) ||
        isToolInvocationInProgress()
      }
      onClick={isLoading ? stop : undefined}
    >
      {isLoading ? <Square size={20} /> : <ArrowUp size={20} />}
    </Button>
  )

  return (
    <div
      className={cn(
        'w-full bg-background group/form-container shrink-0 overflow-hidden',
        messages.length > 0 ? 'sticky bottom-0 px-2 pb-4' : 'px-6',
        'safe-area-bottom' // Ensure it respects safe areas on mobile
      )}
    >
      {messages.length === 0 && (
        <div className="mb-10 flex flex-col items-center gap-4 overflow-hidden">
          <IconLogo className="size-24 text-muted-foreground" key="main-logo" />
          <p className="text-center text-3xl font-semibold">
            كيف يمكنني مساعدتك اليوم؟
          </p>
        </div>
      )}
      <form
        onSubmit={(e) => {
          if (isLoading || isToolInvocationInProgress()) {
            e.preventDefault()
            return
          }
          handleSubmit(e)
        }}
        className={cn('max-w-3xl w-full mx-auto relative overflow-visible')}
      >
        {/* Add scroll-down button to ChatPanel right top - show when not auto scrolling */}
        {!isAutoScroll && messages.length > 0 && (
          <>
            {!isMobile ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  {scrollButton}
                </TooltipTrigger>
                <TooltipContent>
                  <p>الأسفل</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              scrollButton
            )}
          </>
        )}

        <div className="relative flex flex-col w-full gap-2 bg-muted rounded-3xl border border-input">
          <Textarea
            ref={inputRef}
            name="input"
            rows={2}
            maxRows={5}
            tabIndex={0}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="اسأل سؤالاً..."
            spellCheck={false}
            value={input}
            className="resize-none w-full min-h-12 bg-transparent border-0 p-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
            onChange={e => {
              handleInputChange(e)
              setShowEmptyScreen(e.target.value.length === 0)
            }}
            onKeyDown={e => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !isComposing &&
                !enterDisabled
              ) {
                if (input.trim().length === 0 || isLoading || isToolInvocationInProgress()) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const textarea = e.target as HTMLTextAreaElement
                textarea.form?.requestSubmit()
              }
            }}
            onFocus={() => setShowEmptyScreen(true)}
            onBlur={() => setShowEmptyScreen(false)}
          />

          {/* Bottom menu area */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center space-x-2">
              <ModelSelector models={models || []} />
              <SearchModeToggle
                isSearchMode={isSearchMode}
                onSearchModeChange={onSearchModeChange}
              />
              <DeepthinkToggle />
            </div>
            <div className="flex items-center space-x-2">
              {!isMobile ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {submitButton}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isLoading ? 'إيقاف' : 'إرسال'}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                submitButton
              )}
            </div>
          </div>
        </div>

        {/* Terms and Privacy Policy Links */}
        {messages.length === 0 && (
          <div className="mt-3 text-center">
            <p className="text-xs text-muted-foreground" dir="rtl">
              من خلال مراسلة واصل، فإنك توافق على{' '}
              <Link href="/terms" className="text-primary hover:underline">
                شروط الخدمة
              </Link>
              {' '}و{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                بيان الخصوصية
              </Link>
              {' '}الخاصة بنا.
            </p>
          </div>
        )}

        {/* AI Disclaimer - shown after messages are sent */}
        {messages.length > 0 && (
          <div className="mt-2 text-center">
            <p className="text-xs text-muted-foreground" dir="rtl">
              قد يرتكب الذكاء الاصطناعي أخطاء. يرجى التحقق من المعلومات الهامة.
            </p>
          </div>
        )}

        {messages.length === 0 && (
          <EmptyScreen
            submitMessage={message => {
              handleInputChange({
                target: { value: message }
              } as React.ChangeEvent<HTMLTextAreaElement>)
            }}
            className={cn(showEmptyScreen ? 'visible' : 'invisible')}
          />
        )}
      </form>
    </div>
  )
}
