'use client'

import { InspectorDrawer } from '@/components/inspector/inspector-drawer'
import { InspectorPanel } from '@/components/inspector/inspector-panel'
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from '@/components/ui/resizable'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { useUserTier } from '@/hooks/use-user-tier'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { cn } from '@/lib/utils'
import React, { useEffect, useState } from 'react'
import { useArtifact } from './artifact-context'

export function ChatArtifactContainer({
  children
}: {
  children: React.ReactNode
}) {
  const { state } = useArtifact()
  const isMobileQuery = useMediaQuery('(max-width: 767px)') // Below md breakpoint
  const [isMobile, setIsMobile] = useState(isMobileQuery)
  const [renderPanel, setRenderPanel] = useState(state.isOpen)
  const { open, openMobile, isMobile: isMobileSidebar } = useSidebar()
  const { isGuest, isUnknown } = useUserTier()
  const shouldHideSidebar = isGuest || isUnknown

  // Debounce mobile state changes to prevent rapid layout switching
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMobile(isMobileQuery)
    }, 100) // Small delay to prevent rapid changes during orientation

    return () => clearTimeout(timer)
  }, [isMobileQuery])

  useEffect(() => {
    if (state.isOpen) {
      setRenderPanel(true)
    } else {
      setRenderPanel(false)
    }
  }, [state.isOpen])

  return (
    <div className="flex-1 min-h-0 h-full flex overflow-hidden">
      <div className="absolute p-4 z-50 transition-opacity duration-1000">
        {(!open || isMobileSidebar) && !shouldHideSidebar && (
          <SidebarTrigger className="animate-fade-in" />
        )}
      </div>
      
      {/* Stable container for children to prevent remounting */}
      <div className="contents">
        {/* Desktop: Resizable panels - Always rendered, hidden on mobile */}
        <ResizablePanelGroup
          direction="horizontal"
          className={cn(
            "flex flex-1 min-w-0 h-full",
            isMobile ? "hidden" : "flex"
          )}
        >
          <ResizablePanel
            className={cn(
              'min-w-0',
              state.isOpen && 'transition-[flex-basis] duration-200 ease-out'
            )}
          >
            {children}
          </ResizablePanel>

          {renderPanel && (
            <>
              <ResizableHandle />
              <ResizablePanel
                className={cn('overflow-hidden', {
                  'animate-slide-in-right': state.isOpen
                })}
                maxSize={50}
                minSize={30}
                defaultSize={40}
              >
                <InspectorPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* Mobile: full-width chat + drawer - Always rendered, hidden on desktop */}
        <div className={cn(
          "flex-1 h-full overflow-hidden",
          isMobile ? "flex" : "hidden"
        )}>
          {children}
          {/* InspectorDrawer handles its own mobile detection internally */}
          <InspectorDrawer />
        </div>
      </div>
    </div>
  )
}
