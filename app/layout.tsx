export const dynamic = 'force-dynamic';
import AppSidebar from '@/components/app-sidebar';
import ArtifactRoot from '@/components/artifact/artifact-root';
import Header from '@/components/header';
import { SessionInitializer } from '@/components/session-initializer';
import { ThemeProvider } from '@/components/theme-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { Cairo as FontArabic } from 'next/font/google';
import './globals.css';

const fontArabic = FontArabic({
  subsets: ['arabic'],
  variable: '--font-sans'
})

const title = 'واصل'
const description =
  'محرك إجابات مدعوم بالذكاء الاصطناعي مفتوح المصدر بالكامل مع واجهة مستخدم توليدية.'

export const metadata: Metadata = {
  metadataBase: new URL('https://morphic.sh'),
  title,
  description,
  openGraph: {
    title,
    description
  },
  twitter: {
    title,
    description,
    card: 'summary_large_image',
    creator: '@miiura'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  let user = null
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = await createClient()
    const {
      data: { user: supabaseUser }
    } = await supabase.auth.getUser()
    user = supabaseUser
  }

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen flex flex-col font-sans antialiased',
          fontArabic.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <SidebarProvider defaultOpen>
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <Header user={user} />
                <main className="flex flex-1 min-h-0">
                  <ArtifactRoot>{children}</ArtifactRoot>
                </main>
              </div>
            </SidebarProvider>
            <Toaster />
            <Analytics />
            <SessionInitializer />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
