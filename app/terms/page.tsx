import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
              العودة للرئيسية
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-center mb-2">شروط الخدمة</h1>
          <p className="text-muted-foreground text-center">آخر تحديث: {new Date().toLocaleDateString('ar-SA')}</p>
        </div>

        <div className="prose prose-lg max-w-none space-y-6 text-right pb-8" dir="rtl">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. قبول الشروط</h2>
            <p>
              بوصولك واستخدامك لخدمة واصل، فإنك توافق على الالتزام بهذه الشروط والأحكام. 
              إذا كنت لا توافق على أي من هذه الشروط، يرجى عدم استخدام الخدمة.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. وصف الخدمة</h2>
            <p>
              واصل هي منصة ذكية للمحادثة تستخدم تقنيات الذكاء الاصطناعي لتقديم إجابات ومساعدة 
              للمستخدمين باللغة العربية. نحن نسعى لتقديم تجربة محادثة طبيعية ومفيدة.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. استخدام الخدمة</h2>
            <p>يحق لك استخدام الخدمة للأغراض المشروعة فقط. يُمنع استخدام الخدمة لـ:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>أي أنشطة غير قانونية أو ضارة</li>
              <li>نشر محتوى مسيء أو مضلل</li>
              <li>انتهاك حقوق الآخرين</li>
              <li>محاولة اختراق أو إلحاق الضرر بالنظام</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. الخصوصية والبيانات</h2>
            <p>
              نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. لمزيد من التفاصيل، 
              يرجى مراجعة <Link href="/privacy" className="text-primary hover:underline">سياسة الخصوصية</Link> الخاصة بنا.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. إخلاء المسؤولية</h2>
            <p>
              تُقدم الخدمة &ldquo;كما هي&rdquo; دون أي ضمانات. نحن لا نضمن دقة أو اكتمال المعلومات المقدمة 
              من خلال الخدمة، ولا نتحمل المسؤولية عن أي أضرار قد تنتج عن استخدامها.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. تعديل الشروط</h2>
            <p>
              نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إشعارك بأي تغييرات جوهرية، 
              واستمرارك في استخدام الخدمة يعني موافقتك على الشروط المحدثة.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. التواصل</h2>
            <p>
              إذا كان لديك أي أسئلة حول هذه الشروط، يمكنك التواصل معنا من خلال الخدمة نفسها.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
} 