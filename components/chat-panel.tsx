'use client'

import { cn } from '@/lib/utils'
import { type Message } from 'ai'
import { ArrowUp, Square } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useArtifact } from './artifact/artifact-context'
import { DeepthinkToggle } from './deepthink-toggle'
import { EmptyScreen } from './empty-screen'
import { SearchModeToggle } from './search-mode-toggle'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export interface ChatPanelProps {
  messages: Message[]
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  stop: () => void
  isLoading: boolean
  isSearchMode: boolean
  onSearchModeChange: (value: boolean) => void
  setMessages: (messages: Message[]) => void
}

export function ChatPanel({
  messages,
  input,
  handleInputChange,
  onSubmit,
  stop,
  isLoading,
  isSearchMode,
  onSearchModeChange,
  setMessages
}: ChatPanelProps) {
  const [isComposing, setIsComposing] = useState(false)
  const { close: closeArtifact } = useArtifact()
  const router = useRouter()
  const [showEmptyScreen, setShowEmptyScreen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
        <div className="relative flex flex-col w-full gap-2 bg-muted rounded-3xl border border-input">
          <Textarea
            ref={inputRef}
            name="input"
            rows={2}
            tabIndex={0}
            placeholder="اسأل سؤالاً..."
            spellCheck={false}
            value={input}
            className="resize-none w-full min-h-12 bg-transparent border-0 p-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onChange={e => {
              handleInputChange(e)
              setShowEmptyScreen(e.target.value.length === 0)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                if (
                  input.trim().length === 0 ||
                  isLoading ||
                  isToolInvocationInProgress()
                ) {
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
              <SearchModeToggle
                isSearchMode={isSearchMode}
                onSearchModeChange={onSearchModeChange}
              />
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type={isLoading ? 'button' : 'submit'}
                    size="icon"
                    variant="outline"
                    className="rounded-full"
                    disabled={
                      (input.length === 0 && !isLoading) ||
                      isToolInvocationInProgress()
                    }
                    onClick={isLoading ? stop : undefined}
                  >
                    {isLoading ? (
                      <Square size={20} className="animate-pulse" />
                    ) : (
                      <ArrowUp size={20} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isLoading ? 'إيقاف' : 'إرسال'}</p>
                </TooltipContent>
              </Tooltip>
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
