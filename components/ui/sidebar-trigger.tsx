'use client'

import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { PanelRight } from 'lucide-react'
import React from 'react'

export const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <Button
            ref={ref}
            data-sidebar="trigger"
            variant="ghost"
            size="icon"
            className={cn('size-9 z-50 rounded-full hover:bg-accent flex items-center justify-center', className)}
            onClick={event => {
              onClick?.(event)
              toggleSidebar()
            }}
            {...props}
          >
            <PanelRight size={18} />
            <span className="sr-only">فتح القائمة الجانبية</span>
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>القائمة</p>
      </TooltipContent>
    </Tooltip>
  )
})

SidebarTrigger.displayName = 'SidebarTrigger'

export default SidebarTrigger 