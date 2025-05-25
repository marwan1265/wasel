'use client'

import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarInput,
    SidebarMenu
} from '@/components/ui/sidebar'
import { useCurrentUserId } from '@/hooks/use-current-user-id'
import { useDebounce } from '@/hooks/use-debounce'
import { Chat } from '@/lib/types'
import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ChatHistorySkeleton } from './chat-history-skeleton'
import { ChatMenuItem } from './chat-menu-item'
import { ClearHistoryAction } from './clear-history-action'

// interface ChatHistoryClientProps {} // Removed empty interface

interface ChatPageResponse {
  chats: Chat[]
  nextOffset: number | null
}

export function ChatHistoryClient() {
  const userId = useCurrentUserId()
  const [chats, setChats] = useState<Chat[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [isPending, startTransition] = useTransition()

  const fetchInitialChats = useCallback(async () => {
    console.log('[ChatHistory] fetchInitialChats called, userId:', userId)
    if (!userId) {
      setChats([])
      setNextOffset(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      console.log('[ChatHistory] Fetching chats from API...')
      const response = await fetch(`/api/chats?offset=0&limit=20`)
      if (!response.ok) {
        throw new Error('Failed to fetch initial chat history')
      }
      const { chats: newChats, nextOffset: newNextOffset } =
        (await response.json()) as ChatPageResponse

      console.log('[ChatHistory] Received chats:', newChats.length, 'chats')
      setChats(newChats)
      setNextOffset(newNextOffset)
    } catch (error) {
      console.error('Failed to load initial chats:', error)
      toast.error('Failed to load chat history.')
      setChats([])
      setNextOffset(null)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchInitialChats()
  }, [fetchInitialChats, userId])

  useEffect(() => {
    const handleHistoryUpdate = () => {
      console.log('[ChatHistory] Received chat-history-updated event, userId:', userId)
      if (userId) {
        console.log('[ChatHistory] Starting transition to fetch chats')
        startTransition(() => {
          fetchInitialChats()
        })
      } else {
        console.log('[ChatHistory] No userId, skipping fetch')
      }
    }
    window.addEventListener('chat-history-updated', handleHistoryUpdate)
    return () => {
      window.removeEventListener('chat-history-updated', handleHistoryUpdate)
    }
  }, [fetchInitialChats, userId])

  const fetchMoreChats = useCallback(async () => {
    if (isLoading || nextOffset === null || !userId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/chats?offset=${nextOffset}&limit=20`)
      if (!response.ok) {
        throw new Error('Failed to fetch more chat history')
      }
      const { chats: newChats, nextOffset: newNextOffset } =
        (await response.json()) as ChatPageResponse

      setChats(prevChats => [...prevChats, ...newChats])
      setNextOffset(newNextOffset)
    } catch (error) {
      console.error('Failed to load more chats:', error)
      toast.error('Failed to load more chat history.')
    } finally {
      setIsLoading(false)
    }
  }, [nextOffset, isLoading, userId])

  useEffect(() => {
    const observerRefValue = loadMoreRef.current
    if (!observerRefValue || nextOffset === null || isPending || !userId) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoading && !isPending) {
          fetchMoreChats()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(observerRefValue)

    return () => {
      if (observerRefValue) {
        observer.unobserve(observerRefValue)
      }
    }
  }, [fetchMoreChats, nextOffset, isLoading, isPending, userId])

  // Filter chats based on search term
  const filteredChats = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return chats
    }
    
    const searchTermLower = debouncedSearchTerm.toLowerCase()
    return chats.filter(chat => 
      chat.title?.toLowerCase().includes(searchTermLower)
    )
  }, [chats, debouncedSearchTerm])

  const isHistoryEmpty = !isLoading && !chats.length && nextOffset === null

  return (
    <div className="flex flex-col flex-1 h-full">
      {/* Search Bar */}
      {userId && chats.length > 0 && (
        <div className="px-2 pb-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <SidebarInput
              placeholder="بحث في المحادثات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchTerm('')
                }
              }}
              className="pr-10 pl-9 text-right rounded-xl border-muted-foreground/20 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-muted-foreground/40 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                type="button"
                aria-label="مسح البحث"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
      
      <SidebarGroup>
        <div className="flex items-center justify-between w-full">
          <SidebarGroupLabel className="p-0">السجل</SidebarGroupLabel>
          <ClearHistoryAction empty={isHistoryEmpty} />
        </div>
      </SidebarGroup>
      
      <div className="flex-1 overflow-y-auto mb-2 relative">
        {userId && isHistoryEmpty && !isPending ? (
          <div className="px-2 text-foreground/30 text-sm text-center py-4">
            لا يوجد سجل بحث
          </div>
        ) : !userId && !isLoading && !isPending ? (
          <div className="px-2 text-foreground/30 text-sm text-center py-4">
            الرجاء تسجيل الدخول لعرض السجل.
          </div>
        ) : userId && debouncedSearchTerm.trim() && filteredChats.length === 0 ? (
          <div className="px-2 text-foreground/30 text-sm text-center py-4">
            لم يتم العثور على محادثات
          </div>
        ) : (
          <SidebarMenu>
            {userId && filteredChats.map(
              (chat: Chat) => chat && <ChatMenuItem key={chat.id} chat={chat} />
            )}
          </SidebarMenu>
        )}
        {userId && !debouncedSearchTerm.trim() && <div ref={loadMoreRef} style={{ height: '1px' }} />}
        {(isLoading || isPending) && userId && (
          <div className="py-2">
            <ChatHistorySkeleton />
          </div>
        )}
      </div>
    </div>
  )
}
