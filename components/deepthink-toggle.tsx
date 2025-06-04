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
  const [isMobile, setIsMobile] = useState(false)
  const { tier, isPro, isFree, isGuest, isUnknown, isLoading } = useUserTier()

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load saved preference on mount
  useEffect(() => {
    try {
      const savedMode = getCookie('deepthink-mode')
      console.log('Initial deepthink-mode cookie:', savedMode)
      if (savedMode !== null) {
        // Allow deepthink mode for both free and pro users
        const shouldEnable = savedMode === 'true' && (isPro || isFree)
        setIsDeepthinkMode(shouldEnable)
        
        // If user had deepthink enabled but is now guest or unknown, disable it
        if (savedMode === 'true' && (isGuest || isUnknown) && !isLoading) {
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
  }, [isPro, isFree, isGuest, isUnknown, isLoading])

  const toggleDeepthinkMode = () => {
    try {
      const newState = !isDeepthinkMode

      // Check if user is trying to enable deepthink mode
      if (newState) {
        // Show login/signup modal only for guest or unknown users
        if (isGuest || isUnknown) {
          setShowUpgradeModal(true)
          return
        }
        // Free and pro users can use deepthink mode directly
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

  const toggleButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleDeepthinkMode}
      className={cn(
        'flex items-center gap-1 px-3 rounded-full transition-colors',
        // Remove focus outline on mobile
        'focus-visible:outline-none focus-visible:ring-0 md:focus-visible:outline-2 md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2',
        isDeepthinkMode 
          ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100/90 hover:text-black dark:hover:text-black' 
          : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground hover:border-foreground'
      )}
    >
      <DeepResearchIcon className="size-4" />
      <span className="text-xs">بحث عميق</span>
    </Button>
  )

  return (
    <>
      <div className="relative">
        {!isMobile ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {toggleButton}
            </TooltipTrigger>
            <TooltipContent>
              <p>بحث وتفكير متقدم</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          toggleButton
        )}

        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          feature="deepthink"
          userTier={tier === 'guest' ? 'guest' : tier === 'unknown' ? 'unknown' : 'free'}
        />
      </div>
    </>
  )
} 