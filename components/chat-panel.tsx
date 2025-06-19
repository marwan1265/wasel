'use client'

import { cn } from '@/lib/utils'
import { Message } from 'ai'
import { ArrowUp, ChevronDown, Square } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'
import { useArtifact } from './artifact/artifact-context'
import { DeepthinkToggle } from './deepthink-toggle'
import { EmptyScreen } from './empty-screen'
import { SearchModeToggle } from './search-mode-toggle'
import { Button } from './ui/button'
import { IconLogo } from './ui/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export interface ChatPanelProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  messages: Message[]
  setMessages: (messages: Message[]) => void
  stop: () => void
  isSearchMode: boolean
  onSearchModeChange: (value: boolean) => void
  isAutoScroll: boolean
}

export function ChatPanel({
  input,
  handleInputChange,
  onSubmit,
  isLoading,
  messages,
  setMessages,
  stop,
  isSearchMode,
  onSearchModeChange,
  isAutoScroll
}: ChatPanelProps) {
  const [showEmptyScreen, setShowEmptyScreen] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)
  const { close: closeArtifact } = useArtifact()
  const [isMobile, setIsMobile] = useState(false)

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
      size="icon"
      variant="outline"
      className={cn(isLoading && 'animate-pulse', 'rounded-full hover:border-foreground')}
      disabled={(input.length === 0 && !isLoading) || isToolInvocationInProgress()}
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
        'safe-area-bottom'
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
        onSubmit={e => {
          if (isLoading || isToolInvocationInProgress()) {
            e.preventDefault()
            return
          }
          onSubmit(e)
        }}
        className="max-w-3xl w-full mx-auto relative overflow-visible"
      >
        {!isAutoScroll && messages.length > 0 && (
          <>
            {!isMobile ? (
              <Tooltip>
                <TooltipTrigger asChild>{scrollButton}</TooltipTrigger>
                <TooltipContent>
                  <p>الأسفل</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              scrollButton
            )}
          </>
        )}

        <div className="relative flex flex-col w-full gap-2 bg-muted rounded-3xl border border-input focus-within:ring-0">
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
              if (e.key === 'Enter' && !e.shiftKey && !isComposing && !enterDisabled) {
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

          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <DeepthinkToggle />
              <SearchModeToggle isSearchMode={isSearchMode} onSearchModeChange={onSearchModeChange} />
            </div>
            <div className="flex items-center gap-2">
              {!isMobile ? (
                <Tooltip>
                  <TooltipTrigger asChild>{submitButton}</TooltipTrigger>
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
