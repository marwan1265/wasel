'use client'

import { cn } from '@/lib/utils'

interface GlowLoadingTextProps {
  text: string
  className?: string
}

export function GlowLoadingText({ text, className }: GlowLoadingTextProps) {
  return (
    <div className={cn('flex items-center justify-center py-8', className)}>
      <div className="relative inline-block">
        {/* Base text */}
        <div className="text-lg font-medium text-muted-foreground/70 select-none">
          {text}
        </div>
        {/* Glow */}
        <div className="absolute inset-0 text-lg font-medium text-muted-foreground/30 blur-sm animate-pulse select-none">
          {text}
        </div>
        {/* Sliding gradient overlay */}
        <div className="absolute inset-0 overflow-hidden select-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/40 to-transparent w-full h-full animate-slide-gradient -translate-x-full" />
          <div className="absolute inset-0 text-lg font-medium text-transparent bg-clip-text bg-gradient-to-r from-transparent via-foreground/60 to-transparent animate-slide-gradient">
            {text}
          </div>
        </div>
      </div>
    </div>
  )
} 