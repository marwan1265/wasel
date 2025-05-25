'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogPortal,
  DialogTrigger
} from '@/components/ui/dialog'
import { deleteUserAccount } from '@/lib/actions/user'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { User } from '@supabase/supabase-js'
import { LogOut, RotateCcw, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

interface ManageAccountDialogProps {
  user: User
  children: React.ReactNode
}

export function ManageAccountDialog({ user, children }: ManageAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  
  const userName =
    user.user_metadata?.full_name || user.user_metadata?.name || 'مستخدم'
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture

  const getInitials = (name: string, email: string | undefined) => {
    if (name && name !== 'مستخدم') {
      const names = name.split(' ')
      if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.split('@')[0].substring(0, 2).toUpperCase()
    }
    return 'م'
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  const handlePasswordReset = () => {
    setOpen(false)
    router.push('/auth/update-password')
  }

  const handleDeleteAccount = async () => {
    try {
      const result = await deleteUserAccount()
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Sign out after successful deletion
      const supabase = createClient()
      await supabase.auth.signOut()
      setOpen(false)
      toast.success('تم حذف بيانات الحساب بنجاح')
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error('فشل في حذف الحساب. يرجى المحاولة مرة أخرى.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogPortal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/20 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[400px] translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background/95 backdrop-blur-xl p-0 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl border-border/50"
          )}
        >
          <div className="p-6">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold mb-1">إدارة الحساب</h2>
            </div>

            {/* Account Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3 space-x-reverse p-4 rounded-lg bg-accent/20">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={avatarUrl} alt={userName} />
                  <AvatarFallback>{getInitials(userName, user.email)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>

              {/* Account Management Options */}
              <div className="space-y-3">
                {/* Change Password Option */}
                <div className="flex items-center justify-between p-3 rounded-lg">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <RotateCcw className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium">تغيير كلمة المرور</span>
                      <p className="text-xs text-muted-foreground">تحديث كلمة المرور الخاصة بحسابك</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handlePasswordReset}
                    variant="ghost" 
                    className="rounded-full border border-border text-foreground hover:bg-accent hover:text-accent-foreground focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 w-[60px] px-4"
                    size="default"
                  >
                    تغيير
                  </Button>
                </div>

                {/* Delete Account Option */}
                <div className="flex items-center justify-between p-3 rounded-lg">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <div>
                      <span className="text-sm font-medium">حذف الحساب</span>
                      <p className="text-xs text-muted-foreground">حذف الحساب وجميع البيانات<br />المرتبطة به نهائياً</p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="rounded-full border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 w-[60px] px-4"
                        size="default"
                      >
                        حذف
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف الحساب</AlertDialogTitle>
                        <AlertDialogDescription>
                          هذا الإجراء غير قابل للإلغاء. سيتم حذف حسابك وجميع بياناتك نهائياً. هل أنت متأكد من أنك تريد المتابعة؟
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteAccount}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          حذف الحساب
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Logout Button */}
              <div className="pt-4">
                <Button 
                  onClick={handleLogout}
                  className="w-full rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground focus:ring-0 focus:ring-offset-0 border-0"
                  size="sm"
                >
                  <LogOut className="ml-2 h-4 w-4" />
                  تسجيل الخروج
                </Button>
              </div>
            </div>
          </div>
          
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">إغلاق</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
} 