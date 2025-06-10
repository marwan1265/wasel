'use client'

import { ResendVerificationForm } from '@/components/resend-verification-form'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { useSearchParams } from 'next/navigation'

export default function Page() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">شكراً لك على التسجيل!</CardTitle>
              <CardDescription>تحقق من بريدك الإلكتروني للتأكيد</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                لقد تم تسجيلك بنجاح. يرجى التحقق من بريدك الإلكتروني لتأكيد حسابك
                قبل تسجيل الدخول.
              </p>
              
              <ResendVerificationForm initialEmail={email} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
