'use client'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Laptop, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export function ThemeMenuItems() {
  const { setTheme } = useTheme()

  return (
    <>
      <DropdownMenuItem onClick={() => setTheme('light')}>
        <Sun className="ml-3 mr-4 h-4 w-4" />
        <span>فاتح</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('dark')}>
        <Moon className="ml-3 mr-4 h-4 w-4" />
        <span>داكن</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('system')}>
        <Laptop className="ml-3 mr-4 h-4 w-4" />
        <span>النظام</span>
      </DropdownMenuItem>
    </>
  )
}
