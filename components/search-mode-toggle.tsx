'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { setCookie } from '@/lib/utils/cookies'
import { Globe } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'

export interface SearchModeToggleProps {
  isSearchMode: boolean
  onSearchModeChange: (value: boolean) => void
}

export function SearchModeToggle({
  isSearchMode,
  onSearchModeChange
}: SearchModeToggleProps) {
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

  const toggleSearchMode = () => {
    try {
      const newState = !isSearchMode
      onSearchModeChange(newState)
      setCookie('search-mode', newState.toString())
      console.log('Search mode toggled:', newState)
    } catch (error) {
      console.error('Error toggling search mode:', error)
    }
  }

  const toggleButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleSearchMode}
      className={cn(
        'flex items-center gap-1 px-3 rounded-full transition-colors',
        // Remove focus outline on mobile
        'focus-visible:outline-none focus-visible:ring-0 md:focus-visible:outline-2 md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2',
        isSearchMode 
          ? 'bg-accent-blue text-accent-blue-foreground border-accent-blue-border hover:bg-accent-blue/90' 
          : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground hover:border-foreground'
      )}
    >
      <Globe className="size-4" />
      <span className="text-xs">بحث</span>
    </Button>
  )

  return (
    <>
      {!isMobile ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {toggleButton}
          </TooltipTrigger>
          <TooltipContent>
            <p>{isSearchMode ? 'تعطيل البحث' : 'تفعيل البحث'}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        toggleButton
      )}
    </>
  )
}
