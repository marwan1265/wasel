'use client'

import { Button } from '@/components/ui/button'
import { DeepResearchIcon } from '@/components/ui/icons'
import { Sparkles, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  feature: 'deepthink' | 'general'
  userTier: 'guest' | 'free'
}

export function UpgradeModal({ isOpen, onClose, feature, userTier }: UpgradeModalProps) {
  const router = useRouter()
  const popoverRef = useRef<HTMLDivElement>(null)

  const featureConfig = {
    deepthink: {
      icon: DeepResearchIcon,
      title: 'ترقي لواصل برو',
      description: 'فعّل التفكير العميق للحصول على إجابات أكثر ذكاءً ودقة',
      features: [
        'تحليل عميق ومتقدم',
        'إجابات أكثر دقة وتفصيلاً'
      ]
    },
    general: {
      icon: Sparkles,
      title: 'ترقي لواصل برو',
      description: 'احصل على إمكانيات أكثر تقدماً مع واصل برو',
      features: [
        'رسائل أكثر يومياً',
        'وصول للنماذج المتقدمة'
      ]
    }
  }

  const config = featureConfig[feature]
  const IconComponent = config.icon

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const handleUpgrade = () => {
    if (userTier === 'guest') {
      router.push('/auth/login')
    } else {
      router.push('/#pricing')
    }
    onClose()
  }

  const handleSignIn = () => {
    router.push('/auth/login')
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Mobile: Full screen with backdrop */}
      <div className="md:hidden fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop blur */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
        
        {/* Modal content */}
        <div 
          ref={popoverRef}
          className="relative w-full max-w-sm mx-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all duration-200 ease-out"
          style={{
            animation: isOpen ? 'slideDown 0.2s ease-out' : 'slideUp 0.2s ease-in'
          }}
        >
          {/* Gradient Header */}
          <div className="h-16 bg-gradient-to-br from-blue-500 via-blue-400 to-yellow-400 relative">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-2 top-2 z-10 p-0.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
              ترقي لواصل برو
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
              احصل على إجابات أكثر ذكاءً، تحليل عميق، وميزات متقدمة من خلال تسجيل الدخول.
            </p>

            {/* Buttons */}
            <div className="space-y-1.5">
              {userTier === 'guest' ? (
                <Button 
                  onClick={handleSignIn} 
                  className="w-full h-7 bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 rounded-md font-medium text-xs"
                >
                  تسجيل الدخول
                </Button>
              ) : (
                <Button 
                  onClick={handleUpgrade} 
                  className="w-full h-7 bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 rounded-md font-medium text-xs"
                >
                  ترقي الآن
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Popover */}
      <div className="hidden md:block absolute top-full left-0 mt-1 z-50 w-64">
        <div 
          ref={popoverRef}
          className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all duration-200 ease-out"
          style={{
            animation: isOpen ? 'slideDown 0.2s ease-out' : 'slideUp 0.2s ease-in'
          }}
        >
          {/* Gradient Header */}
          <div className="h-16 bg-gradient-to-br from-blue-500 via-blue-400 to-yellow-400 relative">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-2 top-2 z-10 p-0.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
              ترقي لواصل برو
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
              احصل على إجابات أكثر ذكاءً، تحليل عميق، وميزات متقدمة من خلال تسجيل الدخول.
            </p>

            {/* Buttons */}
            <div className="space-y-1.5">
              {userTier === 'guest' ? (
                <Button 
                  onClick={handleSignIn} 
                  className="w-full h-7 bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 rounded-md font-medium text-xs"
                >
                  تسجيل الدخول
                </Button>
              ) : (
                <Button 
                  onClick={handleUpgrade} 
                  className="w-full h-7 bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 rounded-md font-medium text-xs"
                >
                  ترقي الآن
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-10px);
          }
        }
      `}</style>
    </>
  )
} 