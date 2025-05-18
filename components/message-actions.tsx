'use client'

import { CHAT_ID } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { ChatShare } from './chat-share'
import { RetryButton } from './retry-button'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface MessageActionsProps {
  message: string
  messageId: string
  reload?: () => Promise<string | null | undefined>
  chatId?: string
  enableShare?: boolean
  className?: string
}

export function MessageActions({
  message,
  messageId,
  reload,
  chatId,
  enableShare,
  className
}: MessageActionsProps) {
  const { status } = useChat({
    id: CHAT_ID
  })
  const isLoading = status === 'submitted' || status === 'streaming'

  async function handleCopy() {
    await navigator.clipboard.writeText(message)
    toast.success('تم نسخ الرسالة إلى الحافظة')
  }

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 self-end transition-opacity duration-200',
        isLoading ? 'opacity-0' : 'opacity-100',
        className
      )}
    >
      {reload && <RetryButton reload={reload} messageId={messageId} />}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="rounded-full size-9 flex items-center justify-center"
          >
            <Copy size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>نسخ</p>
        </TooltipContent>
      </Tooltip>
      {enableShare && chatId && <ChatShare chatId={chatId} />}
    </div>
  )
}
