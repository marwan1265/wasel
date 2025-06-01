import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <Link href="/">
              <Button variant="ghost" className="mb-4">
                <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                العودة للرئيسية
              </Button>
            </Link>
            <h1 className="text-4xl font-bold text-center mb-2">سياسة الخصوصية</h1>
            <p className="text-muted-foreground text-center">آخر تحديث: {new Date().toLocaleDateString('ar-SA')}</p>
          </div>

          <div className="prose prose-lg max-w-none space-y-6 text-right pb-8" dir="rtl">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. مقدمة</h2>
              <p>
                نحن في واصل نقدر خصوصيتك ونلتزم بحماية معلوماتك الشخصية. توضح هذه السياسة 
                كيفية جمعنا واستخدامنا وحمايتنا لبياناتك عند استخدام خدمتنا.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. المعلومات التي نجمعها</h2>
              <p>قد نجمع الأنواع التالية من المعلومات:</p>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li><strong>معلومات المحادثة:</strong> النصوص والرسائل التي ترسلها إلى الخدمة</li>
                <li><strong>معلومات تقنية:</strong> عنوان IP، نوع المتصفح، ووقت الاستخدام</li>
                <li><strong>ملفات تعريف الارتباط:</strong> لتحسين تجربة الاستخدام</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. كيفية استخدام المعلومات</h2>
              <p>نستخدم المعلومات المجمعة للأغراض التالية:</p>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>تقديم وتحسين خدمة المحادثة الذكية</li>
                <li>فهم كيفية استخدام الخدمة وتطويرها</li>
                <li>ضمان أمان وسلامة المنصة</li>
                <li>الامتثال للمتطلبات القانونية</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. مشاركة المعلومات</h2>
              <p>
                نحن لا نبيع أو نؤجر أو نشارك معلوماتك الشخصية مع أطراف ثالثة، باستثناء الحالات التالية:
              </p>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>عند الحصول على موافقتك الصريحة</li>
                <li>للامتثال للقوانين أو الأوامر القضائية</li>
                <li>لحماية حقوقنا أو سلامة المستخدمين</li>
                <li>مع مقدمي الخدمات الذين يساعدوننا في تشغيل المنصة</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. أمان البيانات</h2>
              <p>
                نتخذ تدابير أمنية مناسبة لحماية معلوماتك من الوصول غير المصرح به أو التغيير 
                أو الكشف أو التدمير. ومع ذلك، لا يمكن ضمان الأمان المطلق عبر الإنترنت.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. الاحتفاظ بالبيانات</h2>
              <p>
                نحتفظ بمعلوماتك طالما كان ذلك ضرورياً لتقديم الخدمة أو للامتثال لالتزاماتنا القانونية. 
                قد نحتفظ ببعض المعلومات لفترات أطول لأغراض الأرشفة أو البحث.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. حقوقك</h2>
              <p>لديك الحق في:</p>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>الوصول إلى معلوماتك الشخصية</li>
                <li>تصحيح المعلومات غير الدقيقة</li>
                <li>طلب حذف معلوماتك</li>
                <li>الاعتراض على معالجة معلوماتك</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. ملفات تعريف الارتباط</h2>
              <p>
                نستخدم ملفات تعريف الارتباط لتحسين تجربتك وتذكر تفضيلاتك. يمكنك إدارة 
                إعدادات ملفات تعريف الارتباط من خلال متصفحك.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. تحديثات السياسة</h2>
              <p>
                قد نحدث هذه السياسة من وقت لآخر. سنقوم بإشعارك بأي تغييرات جوهرية 
                وسنطلب موافقتك عند الضرورة.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. التواصل</h2>
              <p>
                إذا كان لديك أي أسئلة حول سياسة الخصوصية هذه أو ممارساتنا في التعامل مع البيانات، 
                يمكنك التواصل معنا من خلال الخدمة نفسها.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
} 