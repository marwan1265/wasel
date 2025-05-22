'use client'

import { useSidebar } from '@/components/ui/sidebar'
import { useUserTier } from '@/hooks/use-user-tier'
import { CHAT_ID } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { User } from '@supabase/supabase-js'
import { MessageCirclePlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'
import GuestMenu from './guest-menu'
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
  const { isGuest, isLoading, tier } = useUserTier()

  const handleNewChat = () => {
    setMessages([])
    // We don't have access to closeArtifact() here
    router.push('/')
  }

  // Debug logging to see what values we're getting
  console.log('Header Debug:', { 
    hasUser: !!user, 
    isGuest, 
    isLoading, 
    tier,
    userId: user?.id 
  })

  // Determine if we should show guest menu
  // Show guest menu if: no user at all OR user exists but is a guest tier
  // While loading, assume guest to prevent showing wrong menu initially
  const shouldShowGuestMenu = !user || isGuest || (user && isLoading)

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
        {shouldShowGuestMenu ? <GuestMenu /> : <UserMenu user={user!} />}
      </div>
    </header>
  )
}

export default Header
