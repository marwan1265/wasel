'use client'

import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { User } from '@supabase/supabase-js'
// import Link from 'next/link' // No longer needed directly here for Sign In button
import React from 'react'
// import { Button } from './ui/button' // No longer needed directly here for Sign In button
import { CHAT_ID } from '@/lib/constants'
import { useChat } from '@ai-sdk/react'
import { MessageCirclePlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import GuestMenu from './guest-menu'; // Import the new GuestMenu component
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import UserMenu from './user-menu'

interface HeaderProps {
  user: User | null
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const { open } = useSidebar()
  const router = useRouter()
  const { setMessages } = useChat({ id: CHAT_ID })

  const handleNewChat = () => {
    setMessages([])
    // We don't have access to closeArtifact() here
    router.push('/')
  }

  return (
    <header
      className={cn(
        'absolute top-0 left-0 p-2 flex justify-between items-center z-10 backdrop-blur lg:backdrop-blur-none bg-background/80 lg:bg-transparent transition-[width] duration-200 ease-linear',
        open ? 'md:w-[calc(100%-var(--sidebar-width))]' : 'md:w-full',
        'w-full'
      )}
    >
      {/* This div can be used for a logo or title on the left if needed */}
      <div></div>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewChat}
              className="shrink-0 rounded-full group hover:bg-accent"
              type="button"
            >
              <MessageCirclePlus className="size-4 group-hover:rotate-12 transition-all" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>محادثة جديدة</p>
          </TooltipContent>
        </Tooltip>
        {user ? <UserMenu user={user} /> : <GuestMenu />}
      </div>
    </header>
  )
}

export default Header
