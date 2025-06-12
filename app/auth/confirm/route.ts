import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // When user clicks email confirmation link with {{ .ConfirmationURL }},
  // Supabase handles verification automatically and redirects here.
  // We just need to redirect to success page.
  
  redirect('/auth/verification-success')
}
