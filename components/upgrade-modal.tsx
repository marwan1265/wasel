'use client'

import { Button } from '@/components/ui/button'
import { DeepResearchIcon } from '@/components/ui/icons'
import { Sparkles, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  feature: 'deepthink' | 'general'
  userTier: 'guest' | 'free'
}

export function UpgradeModal({ isOpen, onClose, feature, userTier }: UpgradeModalProps) {
  const router = useRouter()
  const popoverRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  // Prevent body scroll on mobile when modal is open
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
    } else {
      document.body.style.overflow = 'unset'
      document.body.style.position = 'unset'
      document.body.style.width = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
      document.body.style.position = 'unset'
      document.body.style.width = 'unset'
    }
  }, [isOpen, isMobile])

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

  // Handle click outside - different behavior for mobile vs desktop
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // For desktop: click outside popover closes it
      if (!isMobile && popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
      // For mobile: click on overlay (but not modal content) closes it
      if (isMobile && overlayRef.current && overlayRef.current === e.target) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, isMobile])

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

  // Render mobile version
  if (isMobile) {
    return (
      <div 
        ref={overlayRef}
        style={{
          position: 'fixed',
          top: '64px', // Start below header (adjust based on your header height)
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2147483647,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          animation: isOpen ? 'fadeIn 0.2s ease-out' : 'fadeOut 0.2s ease-in'
        }}
      >
        <div 
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden w-full max-w-sm mx-auto transform transition-all duration-200 ease-out shadow-2xl"
          style={{
            animation: isOpen ? 'scaleIn 0.2s ease-out' : 'scaleOut 0.2s ease-in'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Gradient Header */}
          <div className="h-20 bg-gradient-to-br from-blue-500 via-blue-400 to-amber-500 relative">
            {/* Close button - moved to left side */}
            <button
              onClick={onClose}
              className="absolute left-3 top-3 z-10 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              ترقي لواصل برو
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              احصل على إجابات أكثر ذكاءً، تحليل عميق، وميزات متقدمة من خلال تسجيل الدخول.
            </p>

            {/* Buttons */}
            <div className="space-y-3">
              {userTier === 'guest' ? (
                <Button 
                  onClick={handleSignIn} 
                  className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 rounded-lg font-medium text-sm"
                >
                  تسجيل الدخول
                </Button>
              ) : (
                <Button 
                  onClick={handleUpgrade} 
                  className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 rounded-lg font-medium text-sm"
                >
                  ترقي الآن
                </Button>
              )}
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          
          @keyframes fadeOut {
            from {
              opacity: 1;
            }
            to {
              opacity: 0;
            }
          }

          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.9) translateY(20px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
          
          @keyframes scaleOut {
            from {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
            to {
              opacity: 0;
              transform: scale(0.9) translateY(20px);
            }
          }
        `}</style>
      </div>
    )
  }

  // Render desktop version
  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-64">
      <div 
        ref={popoverRef}
        className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all duration-200 ease-out"
        style={{
          animation: isOpen ? 'slideDown 0.2s ease-out' : 'slideUp 0.2s ease-in'
        }}
      >
        {/* Gradient Header */}
        <div className="h-16 bg-gradient-to-br from-blue-500 via-blue-400 to-amber-500 relative">
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
    </div>
  )
} 