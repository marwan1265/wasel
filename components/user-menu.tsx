'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Link2, LogOut, Palette, User as UserIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ExternalLinkItems } from './external-link-items'
import { ManageAccountDialog } from './manage-account-dialog'
import { ThemeMenuItems } from './theme-menu-items'
import { Button } from './ui/button'

interface UserMenuProps {
  user: User
}

export default function UserMenu({ user }: UserMenuProps) {
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)
  const userName =
    user.user_metadata?.full_name || user.user_metadata?.name || 'مستخدم'
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const getInitials = (name: string, email: string | undefined) => {
    if (name && name !== 'مستخدم') {
      const names = name.split(' ')
      if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.split('@')[0].substring(0, 2).toUpperCase()
    }
    return 'م'
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const triggerButton = (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="relative h-8 w-8 rounded-full">
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} alt={userName} />
          <AvatarFallback>{getInitials(userName, user.email)}</AvatarFallback>
        </Avatar>
      </Button>
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu>
      {!isMobile ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {triggerButton}
          </TooltipTrigger>
          <TooltipContent>
            <p>الإعدادات</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        triggerButton
      )}
      
      <DropdownMenuContent className="w-60" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">
              {userName}
            </p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Manage Account Button */}
        <ManageAccountDialog user={user}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <UserIcon className="ml-3 mr-4 h-4 w-4" />
            <span>إدارة الحساب</span>
          </DropdownMenuItem>
        </ManageAccountDialog>
        
        <DropdownMenuSeparator />
        
        {/* Theme options (back to nested) */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="ml-3 mr-4 h-4 w-4" />
            <span>المظهر</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ThemeMenuItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Link2 className="ml-3 mr-4 h-4 w-4" />
            <span>روابط</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ExternalLinkItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="ml-3 mr-4 h-4 w-4" />
          <span>تسجيل الخروج</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
