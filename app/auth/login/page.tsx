import { LoginForm } from '@/components/login-form'

export default function Page() {
  return (
    <div className="min-h-svh w-full overflow-y-auto pt-16">
      {/* Mobile layout: scrollable with padding */}
      <div className="flex min-h-[calc(100svh-4rem)] w-full flex-col justify-start p-6 md:hidden">
        <div className="w-full max-w-sm mx-auto pt-4 pb-8">
          <LoginForm />
        </div>
      </div>
      
      {/* Desktop layout: centered */}
      <div className="hidden md:flex min-h-[calc(100svh-4rem)] w-full items-center justify-center p-10">
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
