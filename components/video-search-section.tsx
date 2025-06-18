'use client'

import { useArtifact } from '@/components/artifact/artifact-context'
import { CHAT_ID } from '@/lib/constants'
import type { SerperSearchResults } from '@/lib/types'
import { getCookie } from '@/lib/utils/cookies'
import { useChat } from '@ai-sdk/react'
import { ToolInvocation } from 'ai'
import { useEffect, useState } from 'react'
import { ArabicSearchLoading } from './arabic-search-loading'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { Section, ToolArgsSection } from './section'
import { VideoSearchResults } from './video-search-results'

interface VideoSearchSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function VideoSearchSection({
  tool,
  isOpen,
  onOpenChange
}: VideoSearchSectionProps) {
  const [isSearchMode, setIsSearchMode] = useState(true)
  
  const { status } = useChat({
    id: CHAT_ID
  })
  const isLoading = status === 'submitted' || status === 'streaming'

  // Check search mode from cookie
  useEffect(() => {
    try {
      const savedMode = getCookie('search-mode')
      setIsSearchMode(savedMode !== 'false') // Default to true if not set
    } catch (error) {
      console.error('Error reading search mode:', error)
      setIsSearchMode(true) // Default to true on error
    }
  }, [])

  const isToolLoading = tool.state === 'call'
  const videoResults: SerperSearchResults =
    tool.state === 'result' ? tool.result : undefined
  const query = tool.args?.query as string | undefined

  const { open } = useArtifact()
  const header = (
    <button
      type="button"
      onClick={() => open({ type: 'tool-invocation', toolInvocation: tool })}
      className="flex items-center justify-between w-full text-left rounded-md p-1 -ml-1"
      title="Open details"
    >
      <ToolArgsSection tool="videoSearch" number={videoResults?.videos?.length}>
        {query}
      </ToolArgsSection>
    </button>
  )

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {isLoading && isToolLoading ? (
        isSearchMode ? <ArabicSearchLoading /> : <DefaultSkeleton />
      ) : videoResults ? (
        <Section title="Videos">
          <VideoSearchResults results={videoResults} />
        </Section>
      ) : null}
    </CollapsibleMessage>
  )
}
