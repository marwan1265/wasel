'use client'

import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
    Link2,
    MessageCircleQuestion,
    Palette,
    Settings2 // Or EllipsisVertical, etc.
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { ExternalLinkItems } from './external-link-items'
import { ReportIssueDialog } from './report-issue-dialog'
import { ThemeMenuItems } from './theme-menu-items'

export default function GuestMenu() {
  const [isMobile, setIsMobile] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const triggerButton = (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="rounded-full hover:bg-accent">
        <Settings2 className="h-5 w-5" />
        <span className="sr-only">فتح القائمة</span>
      </Button>
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu>
      {isClient &&
        (!isMobile ? (
          <Tooltip>
            <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
            <TooltipContent>
              <p>الإعدادات</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          triggerButton
        ))}
      
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-3 ml-4 h-4 w-4" />
            <span>المظهر</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ThemeMenuItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Link2 className="mr-3 ml-4 h-4 w-4" />
            <span>روابط</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ExternalLinkItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <ReportIssueDialog>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <MessageCircleQuestion className="mr-3 ml-4 h-4 w-4" />
            <span>تقرير مشكلة</span>
          </DropdownMenuItem>
        </ReportIssueDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
