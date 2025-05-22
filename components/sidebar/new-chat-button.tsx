'use client'

import { useArtifact } from '@/components/artifact/artifact-context'
import { SidebarMenuButton } from '@/components/ui/sidebar'
import { CHAT_ID } from '@/lib/constants'
import { useChat } from '@ai-sdk/react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function NewChatButton() {
  const router = useRouter()
  const { setMessages } = useChat({ id: CHAT_ID })
  const { close: closeArtifact } = useArtifact()

  const handleNewChat = () => {
    setMessages([])
    closeArtifact()
    router.push('/')
  }

  return (
    <SidebarMenuButton onClick={handleNewChat} className="flex items-center gap-2">
      <Plus className="size-4" />
      <span>محادثة جديدة</span>
    </SidebarMenuButton>
  )
} 