'use client'

import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function SignUpSuccessPage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-700">
              تم إنشاء حسابك بنجاح!
            </CardTitle>
            <CardDescription className="text-center">
              {email && (
                <>
                  تم التحقق من البريد الإلكتروني<br />
                  <strong className="text-foreground">{email}</strong><br />
                  بنجاح
                </>
              )}
              <span className="block mt-2">
                يمكنك الآن تسجيل الدخول للاستفادة من جميع المزايا
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href={`/auth/login${email ? `?email=${encodeURIComponent(email)}` : ''}`}>
              <Button className="w-full" size="lg">
                تسجيل الدخول الآن
              </Button>
            </Link>
            
            <div className="text-center">
              <Link href="/" className="text-sm text-muted-foreground hover:underline">
                ← العودة للرئيسية
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 