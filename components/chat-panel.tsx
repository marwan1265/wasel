'use client'

import { useAuthContext } from '@/lib/contexts/auth-context'
import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import {
  ACCEPTED_IMAGE_TYPES_ATTR,
  isAcceptedImageType,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_SIZE_BYTES,
  modelSupportsVision
} from '@/lib/utils/attachments'
import { getCookie } from '@/lib/utils/cookies'
import { Attachment, ChatRequestOptions, Message } from 'ai'
import { ArrowUp, ChevronDown, ImageIcon, Square, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'
import { toast } from 'sonner'
import { useArtifact } from './artifact/artifact-context'
import { DeepthinkToggle } from './deepthink-toggle'
import { EmptyScreen } from './empty-screen'
import { SearchModeToggle } from './search-mode-toggle'
import { Button } from './ui/button'
import { IconLogo } from './ui/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface ChatPanelProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (
    e: React.FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions
  ) => void
  isLoading: boolean
  messages: Message[]
  setMessages: (messages: Message[]) => void
  query?: string
  stop: () => void
  append: (message: any) => void
  models?: Model[]
  /** Whether auto-scroll is currently active (at bottom) */
  isAutoScroll: boolean
  /** A message is queued waiting for auth to complete */
  hasQueuedMessages?: boolean
}

// Read the currently selected model from the cookie set by ModelSelector.
function readSelectedModel(): Model | null {
  const raw = getCookie('selectedModel')
  if (!raw) return null
  try {
    return JSON.parse(decodeURIComponent(raw)) as Model
  } catch {
    try {
      return JSON.parse(raw) as Model
    } catch {
      return null
    }
  }
}

// Read a File into a data URL attachment usable by the AI SDK.
function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve({
        name: file.name,
        contentType: file.type,
        url: reader.result as string
      })
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function ChatPanel({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  messages,
  setMessages,
  query,
  stop,
  append,
  models,
  isAutoScroll,
  hasQueuedMessages = false
}: ChatPanelProps) {
  const { verificationRequired, registerVerificationSlot } = useAuthContext()
  const [showEmptyScreen, setShowEmptyScreen] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false) // Composition state
  const [enterDisabled, setEnterDisabled] = useState(false) // Disable Enter after composition ends
  const { close: closeArtifact } = useArtifact()
  const [isMobile, setIsMobile] = useState(false)

  // Image attachments (multimodal). Kept as AI SDK Attachments (data URLs) so
  // they can be passed straight to handleSubmit via experimental_attachments.
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const visionSupported = modelSupportsVision(selectedModel)

  // Track the active model so the attach control reflects its vision support.
  useEffect(() => {
    setSelectedModel(readSelectedModel())
    const onModelChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as Model | null | undefined
      setSelectedModel(detail ?? readSelectedModel())
    }
    window.addEventListener('selectedModel-change', onModelChange)
    return () =>
      window.removeEventListener('selectedModel-change', onModelChange)
  }, [])

  // If the user switches to a model without vision while images are attached,
  // clear them so we never submit attachments a model can't read.
  useEffect(() => {
    if (!visionSupported && attachments.length > 0) {
      setAttachments([])
      toast.info('تمت إزالة الصور لأن النموذج المحدد لا يدعم الصور.')
    }
  }, [visionSupported, attachments.length])

  const clearAttachments = () => setAttachments([])

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const incoming = Array.from(fileList)
    // Reset the input so selecting the same file again re-triggers onChange.
    e.target.value = ''

    const accepted: File[] = []
    for (const file of incoming) {
      if (!isAcceptedImageType(file.type)) {
        toast.error(`نوع الملف غير مدعوم: ${file.name}`)
        continue
      }
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        toast.error(
          `الملف كبير جدًا (الحد الأقصى ${Math.round(
            MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)
          )} ميجابايت): ${file.name}`
        )
        continue
      }
      accepted.push(file)
    }

    if (accepted.length === 0) return

    const remainingSlots = MAX_ATTACHMENTS - attachments.length
    if (remainingSlots <= 0) {
      toast.error(`يمكنك إرفاق ${MAX_ATTACHMENTS} صور كحد أقصى.`)
      return
    }
    const toAdd = accepted.slice(0, remainingSlots)
    if (accepted.length > remainingSlots) {
      toast.error(`يمكنك إرفاق ${MAX_ATTACHMENTS} صور كحد أقصى.`)
    }

    try {
      const newAttachments = await Promise.all(toAdd.map(fileToAttachment))
      setAttachments(prev => [...prev, ...newAttachments])
    } catch (error) {
      console.error('Failed to read attachment:', error)
      toast.error('تعذر قراءة الملف المرفق.')
    }
  }

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 300)
  }

  const handleNewChat = () => {
    setMessages([])
    closeArtifact()
    router.push('/')
  }

  const isToolInvocationInProgress = () => {
    if (!messages.length) return false

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant' || !lastMessage.parts) return false

    const parts = lastMessage.parts
    const lastPart = parts[parts.length - 1]

    return (
      lastPart?.type === 'tool-invocation' &&
      lastPart?.toolInvocation?.state === 'call'
    )
  }

  // if query is not empty, submit the query
  useEffect(() => {
    if (isFirstRender.current && query && query.trim().length > 0) {
      append({
        role: 'user',
        content: query
      })
      isFirstRender.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Add scroll to bottom handler
  const handleScrollToBottom = () => {
    const scrollContainer = document.getElementById('scroll-container')
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  const scrollButton = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="absolute -top-10 right-4 z-20 size-8 rounded-full shadow-md"
      onClick={handleScrollToBottom}
    >
      <ChevronDown size={16} />
    </Button>
  )

  // Submit the form, forwarding any image attachments to the model and then
  // clearing them. Used by both the send button and the Enter key.
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (isLoading || isToolInvocationInProgress()) {
      e.preventDefault()
      return
    }
    if (input.trim().length === 0 && attachments.length === 0) {
      e.preventDefault()
      return
    }
    const options: ChatRequestOptions | undefined =
      attachments.length > 0
        ? { experimental_attachments: attachments }
        : undefined
    handleSubmit(e, options)
    clearAttachments()
  }

  const submitButton = (
    <Button
      type={isLoading ? 'button' : 'submit'}
      size={'icon'}
      variant={'outline'}
      className={cn(isLoading && 'animate-pulse', 'rounded-full hover:border-foreground')}
      disabled={
        (input.length === 0 && attachments.length === 0 && !isLoading) ||
        isToolInvocationInProgress()
      }
      onClick={isLoading ? stop : undefined}
    >
      {isLoading ? <Square size={20} /> : <ArrowUp size={20} />}
    </Button>
  )

  const attachButton = (
    <Button
      type="button"
      size={'icon'}
      variant={'outline'}
      className="rounded-full hover:border-foreground"
      disabled={!visionSupported || isLoading}
      aria-label="إرفاق صورة"
      onClick={() => fileInputRef.current?.click()}
    >
      <ImageIcon size={18} />
    </Button>
  )

  return (
    <div
      className={cn(
        'w-full bg-background group/form-container shrink-0 overflow-hidden',
        messages.length > 0 ? 'sticky bottom-0 px-2 pb-4' : 'px-6',
        'safe-area-bottom' // Ensure it respects safe areas on mobile
      )}
    >
      {messages.length === 0 && (
        <div className="mb-10 flex flex-col items-center gap-4 overflow-hidden">
          <IconLogo className="size-24 text-muted-foreground" key="main-logo" />
          <p className="text-center text-3xl font-semibold">
            كيف يمكنني مساعدتك اليوم؟
          </p>
        </div>
      )}
      <form
        onSubmit={handleFormSubmit}
        className={cn('max-w-3xl w-full mx-auto relative overflow-visible')}
      >
        {/* Hidden file input for image attachments */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES_ATTR}
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
        {/* Add scroll-down button to ChatPanel right top - show when not auto scrolling */}
        {!isAutoScroll && messages.length > 0 && (
          <>
            {!isMobile ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  {scrollButton}
                </TooltipTrigger>
                <TooltipContent>
                  <p>الأسفل</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              scrollButton
            )}
          </>
        )}

        {/* Inline human-verification: the invisible Turnstile widget lives
            here (portaled in by SessionInitializerWithContext). It is only
            surfaced when Cloudflare requires interaction and a message is
            waiting to send; completing it flushes the queued message. */}
        <div
          className={cn(
            verificationRequired && hasQueuedMessages
              ? 'mb-2 flex flex-col items-center gap-1'
              : 'invisible h-0 overflow-hidden'
          )}
        >
          {verificationRequired && hasQueuedMessages && (
            <p className="text-xs text-muted-foreground" dir="rtl">
              تحقق سريع لإرسال رسالتك
            </p>
          )}
          <div ref={registerVerificationSlot} />
        </div>

        <div className="relative flex flex-col w-full gap-2 bg-muted rounded-3xl border border-input">
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3" dir="rtl">
              {attachments.map((attachment, index) => (
                <div
                  key={`${attachment.name ?? 'image'}-${index}`}
                  className="relative group/attachment"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.url}
                    alt={attachment.name ?? 'مرفق'}
                    className="size-16 rounded-lg object-cover border border-input"
                  />
                  <button
                    type="button"
                    aria-label="إزالة المرفق"
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-1.5 -left-1.5 rounded-full bg-background border border-input p-0.5 shadow-sm opacity-0 group-hover/attachment:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Textarea
            ref={inputRef}
            name="input"
            rows={2}
            maxRows={5}
            tabIndex={0}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="اسأل سؤالاً..."
            spellCheck={false}
            value={input}
            className="resize-none w-full min-h-12 bg-transparent border-0 p-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
            onChange={e => {
              handleInputChange(e)
              setShowEmptyScreen(e.target.value.length === 0)
            }}
            onKeyDown={e => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !isComposing &&
                !enterDisabled
              ) {
                if (
                  (input.trim().length === 0 && attachments.length === 0) ||
                  isLoading ||
                  isToolInvocationInProgress()
                ) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const textarea = e.target as HTMLTextAreaElement
                textarea.form?.requestSubmit()
              }
            }}
            onFocus={() => setShowEmptyScreen(true)}
            onBlur={() => setShowEmptyScreen(false)}
          />

          {/* Bottom menu area */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <DeepthinkToggle />
              <SearchModeToggle />
              {!isMobile ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>{attachButton}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {visionSupported
                        ? 'إرفاق صورة'
                        : 'النموذج الحالي لا يدعم الصور'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                attachButton
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isMobile ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {submitButton}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isLoading ? 'إيقاف' : 'إرسال'}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                submitButton
              )}
            </div>
          </div>
        </div>

        {/* Terms and Privacy Policy Links */}
        {messages.length === 0 && (
          <div className="mt-3 text-center">
            <p className="text-xs text-muted-foreground" dir="rtl">
              من خلال مراسلة واصل، فإنك توافق على{' '}
              <Link href="/terms" className="text-primary hover:underline">
                شروط الخدمة
              </Link>
              {' '}و{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                بيان الخصوصية
              </Link>
              {' '}الخاصة بنا.
            </p>
          </div>
        )}

        {/* AI Disclaimer - shown after messages are sent */}
        {messages.length > 0 && (
          <div className="mt-2 text-center">
            <p className="text-xs text-muted-foreground" dir="rtl">
              قد يرتكب الذكاء الاصطناعي أخطاء. يرجى التحقق من المعلومات الهامة.
            </p>
          </div>
        )}

        {messages.length === 0 && (
          <EmptyScreen
            submitMessage={message => {
              handleInputChange({
                target: { value: message }
              } as React.ChangeEvent<HTMLTextAreaElement>)
            }}
            className={cn(showEmptyScreen ? 'visible' : 'invisible')}
          />
        )}
      </form>
    </div>
  )
}
