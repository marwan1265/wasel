'use client'

import { Button } from '@/components/ui/button'
import { AlertTriangle, Clock, LogIn } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface RateLimitErrorProps {
  reason?: 'daily_limit' | 'time_window_limit'
  timeRemaining?: string
  canSignIn?: boolean
  upgradeAction?: 'signin' | 'upgrade' | null
  onDismiss?: () => void
}

export function RateLimitError({ 
  reason, 
  timeRemaining, 
  canSignIn = true,
  upgradeAction,
  onDismiss 
}: RateLimitErrorProps) {
  const router = useRouter()

  const handleAction = () => {
    if (onDismiss) onDismiss()
    if (upgradeAction === 'signin') {
      router.push('/auth/login')
    } else if (upgradeAction === 'upgrade') {
      // Navigate to pricing/upgrade page
      router.push('/pricing') // Adjust this URL as needed
    }
  }

  const getActionButtonText = () => {
    if (upgradeAction === 'signin') return 'تسجيل الدخول'
    if (upgradeAction === 'upgrade') return 'ترقية الباقة'
    return null
  }

  const shouldShowActionButton = upgradeAction === 'signin' || upgradeAction === 'upgrade'

  const title = reason === 'daily_limit' 
    ? 'تم الوصول للحد اليومي' 
    : 'تم الوصول للحد المسموح'

  const description = reason === 'daily_limit'
    ? 'لقد وصلت للحد اليومي للرسائل.'
    : `لقد أرسلت رسائل كثيرة. ${timeRemaining ? `حاول مرة أخرى خلال ${timeRemaining}.` : 'يرجى الانتظار قبل المحاولة مرة أخرى.'}`

  return (
    <div className="flex items-center gap-3 p-4 border rounded-lg bg-orange-50 border-orange-200 dark:bg-orange-950/50 dark:border-orange-800">
      <div className="flex-shrink-0">
        <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200">
          {title}
        </h4>
        <p className="text-sm text-orange-700 dark:text-orange-300">
          {description}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {timeRemaining && (
          <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
            <Clock className="w-3 h-3" />
            <span className="font-mono">{timeRemaining}</span>
          </div>
        )}
        
        {shouldShowActionButton && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleAction}
            className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/50"
          >
            <LogIn className="w-4 h-4 mr-1" />
            {getActionButtonText()}
          </Button>
        )}
      </div>
    </div>
  )
}

// Helper function to show rate limit error as toast
export function showRateLimitToast(errorData: {
  reason?: 'daily_limit' | 'time_window_limit'
  timeRemaining?: string
  canSignIn?: boolean
  upgradeAction?: 'signin' | 'upgrade' | null
}) {
  const handleAction = () => {
    toast.dismiss()
    if (errorData.upgradeAction === 'signin') {
      window.location.href = '/auth/login'
    } else if (errorData.upgradeAction === 'upgrade') {
      window.location.href = '/pricing'
    }
  }

  const getActionLabel = () => {
    if (errorData.upgradeAction === 'signin') return 'تسجيل الدخول'
    if (errorData.upgradeAction === 'upgrade') return 'ترقية الباقة'
    return null
  }

  const title = errorData.reason === 'daily_limit' 
    ? 'تم الوصول للحد اليومي' 
    : 'تم الوصول للحد المسموح'

  const description = errorData.reason === 'daily_limit'
    ? 'لقد وصلت للحد اليومي للرسائل.'
    : `لقد أرسلت رسائل كثيرة. ${errorData.timeRemaining ? `حاول مرة أخرى خلال ${errorData.timeRemaining}.` : ''}`

  const actionLabel = getActionLabel()

  toast.error(title, {
    description,
    duration: 8000, // Show for 8 seconds
    action: actionLabel ? {
      label: actionLabel,
      onClick: handleAction
    } : undefined
  })
} 