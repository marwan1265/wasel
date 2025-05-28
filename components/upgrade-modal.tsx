'use client'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { DeepResearchIcon } from '@/components/ui/icons'
import { Sparkles, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  feature: 'deepthink' | 'general'
  userTier: 'guest' | 'free'
}

export function UpgradeModal({ isOpen, onClose, feature, userTier }: UpgradeModalProps) {
  const router = useRouter()

  const featureConfig = {
    deepthink: {
      icon: DeepResearchIcon,
      title: 'ترقي لواصل برو للوصول للتفكير المتقدم',
      description: 'احصل على إجابات أكثر ذكاءً وتفصيلاً مع نماذج الذكاء الاصطناعي الأكثر تقدماً',
      features: [
        'تفكير عميق ومتقدم مع نماذج التفكير الذكية',
        'تحليل أكثر دقة وتفصيلاً',
        'إجابات معمقة للأسئلة المعقدة',
        'أولوية في المعالجة'
      ]
    },
    general: {
      icon: Sparkles,
      title: 'ترقي لواصل برو',
      description: 'احصل على إمكانيات أكثر تقدماً مع واصل برو',
      features: [
        'رسائل أكثر يومياً',
        'وصول للنماذج المتقدمة',
        'أولوية في المعالجة',
        'ميزات حصرية جديدة'
      ]
    }
  }

  const config = featureConfig[feature]
  const IconComponent = config.icon

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <IconComponent className="h-6 w-6 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                برو
              </span>
            </div>
          </div>
          <DialogTitle className="text-xl font-semibold">
            {config.title}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-3">
            {config.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="h-2 w-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {userTier === 'guest' ? (
            <>
              <Button onClick={handleSignIn} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
                <Sparkles className="h-4 w-4 ml-2" />
                تسجيل الدخول للترقية
              </Button>
              <Button variant="outline" onClick={onClose} className="w-full">
                ليس الآن
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleUpgrade} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
                <Sparkles className="h-4 w-4 ml-2" />
                ترقي لواصل برو
              </Button>
              <Button variant="outline" onClick={onClose} className="w-full">
                ليس الآن
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 