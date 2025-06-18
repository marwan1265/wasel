'use client'

import { cn } from '@/lib/utils'

interface ArabicSearchLoadingProps {
  className?: string
}

export function ArabicSearchLoading({ className }: ArabicSearchLoadingProps) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <div className="relative inline-block">
        {/* Base text with glow */}
        <div className="text-lg font-medium text-muted-foreground/70 select-none">
          جاري البحث...
        </div>
        
        {/* Glow effect */}
        <div className="absolute inset-0 text-lg font-medium text-muted-foreground/30 blur-sm animate-pulse select-none">
          جاري البحث...
        </div>
        
        {/* Sliding gradient overlay */}
        <div className="absolute inset-0 overflow-hidden select-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/40 to-transparent w-full h-full animate-slide-gradient -translate-x-full">
          </div>
          <div className="absolute inset-0 text-lg font-medium text-transparent bg-clip-text bg-gradient-to-r from-transparent via-foreground/60 to-transparent animate-slide-gradient">
            جاري البحث...
          </div>
        </div>
      </div>
    </div>
  )
} 