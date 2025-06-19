'use client'

import { type Message } from 'ai'
import { ArrowUp, Square } from 'lucide-react'
import { useState } from 'react'

import Link from 'next/link'
import { DeepthinkToggle } from './deepthink-toggle'
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
}

export function ChatPanel({
  messages,
  input,
  handleInputChange,
  onSubmit,
  stop,
  isLoading,
  isSearchMode,
  onSearchModeChange
}: ChatPanelProps) {
  const [isComposing, setIsComposing] = useState(false)

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
    <div className="fixed inset-x-0 bottom-0 bg-gradient-to-b from-muted/10 from-10% to-muted/30 to-50%">
      <div className="mx-auto sm:max-w-2xl sm:px-4">
        <div className="flex items-center justify-center space-x-2 h-12">
          <SearchModeToggle
            isSearchMode={isSearchMode}
            onSearchModeChange={onSearchModeChange}
          />
          <DeepthinkToggle />
        </div>

        <form onSubmit={onSubmit}>
          <div className="relative flex flex-col w-full px-4 py-2 space-y-4 border-t shadow-lg bg-background sm:rounded-t-xl sm:border md:py-4">
            <Textarea
              name="input"
              rows={1}
              value={input}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onChange={handleInputChange}
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
              placeholder="اسأل سؤالاً..."
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <div>
                {/* Reserved for future elements if needed */}
              </div>
              <div className="flex items-center space-x-2">
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
            {messages.length === 0 && (
             <p className="text-xs text-center text-muted-foreground" dir="rtl">
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
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
