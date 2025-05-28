'use client'

import { useSidebar } from '@/components/ui/sidebar'
import { CHAT_ID } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { User } from '@supabase/supabase-js'
import { MessageCirclePlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React from 'react'
import GuestMenu from './guest-menu'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import UserMenu from './user-menu'

interface HeaderProps {
  user: User | null
  isGuestUser: boolean
}

export const Header: React.FC<HeaderProps> = ({ user, isGuestUser }) => {
  const { open } = useSidebar()
  const router = useRouter()
  const { setMessages } = useChat({ id: CHAT_ID })

  const handleNewChat = () => {
    setMessages([])
    // We don't have access to closeArtifact() here
    router.push('/')
  }

  // Use server-side guest determination to eliminate flickering
  const shouldShowGuestMenu = !user || isGuestUser

  return (
    <header
      className={cn(
        'absolute top-0 left-0 p-2 flex justify-between items-center z-10 backdrop-blur lg:backdrop-blur-none bg-background/80 lg:bg-transparent transition-[width] duration-200 ease-linear',
        open ? 'md:w-[calc(100%-var(--sidebar-width))]' : 'md:w-full',
        'w-full'
      )}
    >
      {/* Left side - Auth Buttons for guests */}
      <div className="flex items-center gap-2 ml-2">
        {shouldShowGuestMenu ? (
          <>
            <Link href="/auth/login">
              <Button 
                variant="default" 
                size="sm"
                className="rounded-full px-4 bg-black text-white hover:bg-gray-800 transition-colors duration-200"
              >
                تسجيل الدخول
              </Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button 
                variant="outline" 
                size="sm"
                className="rounded-full px-4 border-gray-300 hover:bg-gray-100 hover:border-gray-400 transition-colors duration-200"
              >
                إنشاء حساب
              </Button>
            </Link>
          </>
        ) : (
          <div></div>
        )}
      </div>

      {/* Right side - New Chat Button and Settings/User Menu */}
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
