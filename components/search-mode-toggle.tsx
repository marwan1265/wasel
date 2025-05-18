'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getCookie, setCookie } from '@/lib/utils/cookies'
import { Globe } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'

export function SearchModeToggle() {
  const [isSearchMode, setIsSearchMode] = useState(true)

  // Load saved preference on mount
  useEffect(() => {
    try {
      const savedMode = getCookie('search-mode')
      if (savedMode !== null) {
        setIsSearchMode(savedMode === 'true')
      } else {
        // Default to true and save preference
        setCookie('search-mode', 'true')
      }
    } catch (error) {
      console.error('Error accessing cookies:', error)
    }
  }, [])

  const toggleSearchMode = () => {
    try {
      const newState = !isSearchMode
      setIsSearchMode(newState)
      setCookie('search-mode', newState.toString())
      console.log('Search mode toggled:', newState)
    } catch (error) {
      console.error('Error toggling search mode:', error)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleSearchMode}
          className={cn(
            'flex items-center gap-1 px-3 rounded-full transition-colors',
            isSearchMode 
              ? 'bg-accent-blue text-accent-blue-foreground border-accent-blue-border hover:bg-accent-blue/90' 
              : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground hover:border-foreground'
          )}
        >
          <Globe className="size-4" />
          <span className="text-xs">بحث</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isSearchMode ? 'تعطيل البحث' : 'تفعيل البحث'}</p>
      </TooltipContent>
    </Tooltip>
  )
}
