'use client'

import { RotateCcw } from 'lucide-react'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface RetryButtonProps {
  reload: () => Promise<string | null | undefined>
  messageId: string
}

export const RetryButton: React.FC<RetryButtonProps> = ({
  reload,
  messageId
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="rounded-full size-9 flex items-center justify-center"
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => reload()}
          aria-label={`Retry from message ${messageId}`}
        >
          <RotateCcw className="w-4 h-4" />
          <span className="sr-only">Retry</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>إعادة</p>
      </TooltipContent>
    </Tooltip>
  )
}
