import { createClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { email, captchaToken } = body

    // Validate input
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }

    // Allow bypassing CAPTCHA for certain resend scenarios (like from OTP page)
    // In production, you might want to implement different validation logic
    if (!captchaToken || typeof captchaToken !== 'string') {
      if (captchaToken !== 'bypass-for-resend') {
        return NextResponse.json(
          { error: 'CAPTCHA verification is required' },
          { status: 400 }
        )
      }
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Supabase handles rate limiting (300 emails/hour, 360 token verifications/hour per IP)

    const supabase = await createClient()

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: captchaToken !== 'bypass-for-resend' ? {
        captchaToken: captchaToken
      } : undefined
    })

    if (error) {
      // Log error for monitoring
      console.error('Resend verification error:', {
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Obfuscate email for logs
        error: error.message,
        timestamp: new Date().toISOString()
      })

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }



    // Log successful resend for monitoring
    console.log('Verification resend successful:', {
      email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      { message: 'Verification code sent successfully' },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('Resend verification server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 