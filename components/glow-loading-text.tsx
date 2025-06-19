'use client'

import { cn } from '@/lib/utils'

interface GlowLoadingTextProps {
  text: string
  className?: string
}

export function GlowLoadingText({ text, className }: GlowLoadingTextProps) {
  return (
    <div className={cn('py-2', className)}>
      <span className="relative inline-block text-sm font-medium text-muted-foreground/75 overflow-hidden">
        {text}
        {/* Shimmer effect overlay */}
        <span 
          className="absolute inset-0 w-full h-full animate-shimmer"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)',
            maskImage: `linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)`,
            WebkitMaskImage: `linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)`
          }}
        />
      </span>
    </div>
  )
} 