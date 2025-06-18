'use client'

import { cn } from '@/lib/utils'

interface GlowLoadingTextProps {
  text: string
  className?: string
}

export function GlowLoadingText({ text, className }: GlowLoadingTextProps) {
  return (
    <div className={cn('py-2', className)}>
      <span className="relative inline-block overflow-hidden select-none text-sm font-medium text-muted-foreground/70">
        {text}
        {/* Sliding highlight */}
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/60 to-transparent bg-clip-text text-transparent animate-slide-gradient" />
      </span>
    </div>
  )
} 