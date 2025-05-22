import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarRail
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Suspense } from 'react'
import { ChatHistorySection } from './sidebar/chat-history-section'
import { ChatHistorySkeleton } from './sidebar/chat-history-skeleton'
import { NewChatButton } from './sidebar/new-chat-button'
import { IconLogo } from './ui/icons'
import SidebarTrigger from './ui/sidebar-trigger'

export default function AppSidebar() {
  return (
    <Sidebar side="right" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="flex flex-row justify-between items-center">
        <SidebarTrigger />
        <Link href="/" className="flex items-center justify-center gap-1 px-2 py-3">
          <IconLogo className={cn('h-7 w-7 translate-y-[2px]')} />
          <span className="font-semibold text-sm translate-y-[1px]">واصل</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex flex-col px-2 py-4 h-full">
        <SidebarMenu>
          <SidebarMenuItem>
            <NewChatButton />
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<ChatHistorySkeleton />}>
            <ChatHistorySection />
          </Suspense>
        </div>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
