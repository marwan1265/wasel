'use client'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { SiInstagram, SiX } from 'react-icons/si'

const externalLinks = [
  {
    name: 'X',
    href: 'https://x.com/wasel_chat',
    icon: <SiX className="ml-3 mr-4 h-4 w-4" />
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/wasel.chat',
    icon: <SiInstagram className="ml-3 mr-4 h-4 w-4" />
  }
]

export function ExternalLinkItems() {
  return (
    <>
      {externalLinks.map(link => (
        <DropdownMenuItem key={link.name} asChild>
          <Link href={link.href} target="_blank" rel="noopener noreferrer">
            {link.icon}
            <span>{link.name}</span>
          </Link>
        </DropdownMenuItem>
      ))}
    </>
  )
}
