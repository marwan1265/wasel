'use client'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircleQuestion } from 'lucide-react'
import { useState } from 'react'

interface ReportIssueDialogProps {
  children: React.ReactNode
}

export function ReportIssueDialog({ children }: ReportIssueDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    email: '',
    name: ''
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const subject = encodeURIComponent(formData.subject || 'تقرير مشكلة - Wasel Chat')
    const body = encodeURIComponent(`
الاسم: ${formData.name || 'غير محدد'}
البريد الإلكتروني: ${formData.email || 'غير محدد'}

وصف المشكلة:
${formData.description}

---
تم إرسال هذا التقرير من تطبيق Wasel Chat
    `.trim())
    
    const mailtoLink = `mailto:support@wasel.chat?subject=${subject}&body=${body}`
    window.location.href = mailtoLink
    
    // Reset form and close dialog
    setFormData({
      subject: '',
      description: '',
      email: '',
      name: ''
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircleQuestion className="h-5 w-5" />
            تقرير مشكلة
          </DialogTitle>
          <DialogDescription>
            يرجى وصف المشكلة التي واجهتها وسنقوم بالرد عليك في أقرب وقت ممكن.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">الاسم (اختياري)</Label>
              <Input
                id="name"
                placeholder="اسمك"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني (اختياري)</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">الموضوع</Label>
            <Input
              id="subject"
              placeholder="عنوان المشكلة"
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">وصف المشكلة *</Label>
            <Textarea
              id="description"
              placeholder="يرجى وصف المشكلة بالتفصيل..."
              className="min-h-[120px]"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
            >
              إلغاء
            </Button>
            <Button 
              type="submit" 
              disabled={!formData.description.trim()}
            >
              إرسال التقرير
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 