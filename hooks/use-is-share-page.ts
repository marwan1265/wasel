'use client'

import { usePathname } from 'next/navigation'

export function useIsSharePage(): boolean {
  const pathname = usePathname()
  return pathname ? pathname.startsWith('/share/') : false
} 