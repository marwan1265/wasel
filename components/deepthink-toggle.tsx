'use client'

import { DeepResearchIcon } from '@/components/ui/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useUserTier } from '@/hooks/use-user-tier'
import { cn } from '@/lib/utils'
import { getCookie, setCookie } from '@/lib/utils/cookies'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { UpgradeModal } from './upgrade-modal'

export function DeepthinkToggle() {
  const [isDeepthinkMode, setIsDeepthinkMode] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const { tier, isPro, isLoading } = useUserTier()

  // Load saved preference on mount
  useEffect(() => {
    try {
      const savedMode = getCookie('deepthink-mode')
      console.log('Initial deepthink-mode cookie:', savedMode)
      if (savedMode !== null) {
        // Only allow deepthink mode if user is pro
        const shouldEnable = savedMode === 'true' && isPro
        setIsDeepthinkMode(shouldEnable)
        
        // If user had deepthink enabled but is no longer pro, disable it
        if (savedMode === 'true' && !isPro && !isLoading) {
          setCookie('deepthink-mode', 'false')
          // Reset to default model
          const defaultModel = { id: 'deepseek-chat', name: 'DeepSeek V3 (Default)', provider: 'DeepSeek', providerId: 'deepseek', enabled: true, toolCallType: 'manual' }
          setCookie('selectedModel', JSON.stringify(defaultModel))
        }
      } else {
        // Default to false and save preference
        setCookie('deepthink-mode', 'false')
      }
      
      // Log the current selected model
      const currentModel = getCookie('selectedModel')
      console.log('Current selectedModel cookie:', currentModel)
    } catch (error) {
      console.error('Error accessing cookies:', error)
    }
  }, [isPro, isLoading])

  const toggleDeepthinkMode = () => {
    try {
      const newState = !isDeepthinkMode

      // Check if user is trying to enable deepthink mode
      if (newState && !isPro) {
        // Show upgrade modal for non-pro users
        setShowUpgradeModal(true)
        return
      }

      setIsDeepthinkMode(newState)
      setCookie('deepthink-mode', newState.toString())
      
      // Save the selected model based on the toggle state
      const modelToUse = newState 
        ? { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Deep Think)', provider: 'DeepSeek', providerId: 'deepseek', enabled: true, toolCallType: 'manual', toolCallModel: 'deepseek-chat' }
        : { id: 'deepseek-chat', name: 'DeepSeek V3 (Default)', provider: 'DeepSeek', providerId: 'deepseek', enabled: true, toolCallType: 'manual' }
        
      console.log('Setting model to:', modelToUse)
      setCookie('selectedModel', JSON.stringify(modelToUse))
      
      // Verify the cookie was set
      setTimeout(() => {
        const updatedModel = getCookie('selectedModel')
        console.log('Updated selectedModel cookie:', updatedModel)
      }, 100)
    } catch (error) {
      console.error('Error toggling deepthink mode:', error)
    }
  }

  return (
    <>
      <div className="relative">
        {/* Mobile: Button without tooltip */}
        <div className="md:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleDeepthinkMode}
            className={cn(
              'flex items-center gap-1 px-3 rounded-full transition-colors',
              // Remove focus outline on mobile
              'focus-visible:outline-none focus-visible:ring-0',
              isDeepthinkMode 
                ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100/90 hover:text-black dark:hover:text-black' 
                : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground hover:border-foreground'
            )}
          >
            <DeepResearchIcon className="size-4" />
            <span className="text-xs">بحث عميق</span>
          </Button>
        </div>

        {/* Desktop: Button with tooltip */}
        <div className="hidden md:block">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleDeepthinkMode}
                className={cn(
                  'flex items-center gap-1 px-3 rounded-full transition-colors',
                  // Focus outline for desktop
                  'focus-visible:outline-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isDeepthinkMode 
                    ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100/90 hover:text-black dark:hover:text-black' 
                    : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground hover:border-foreground'
                )}
              >
                <DeepResearchIcon className="size-4" />
                <span className="text-xs">بحث عميق</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>بحث وتفكير متقدم</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          feature="deepthink"
          userTier={tier === 'guest' ? 'guest' : 'free'}
        />
      </div>
    </>
  )
} 