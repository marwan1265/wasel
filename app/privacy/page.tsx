import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* زر العودة */}
          <div className="flex justify-end mb-4 mt-12">
            <Link href="/">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-4 border-gray-300 hover:bg-gray-100 hover:border-gray-400 transition-colors duration-200"
              >
                <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                العودة للرئيسية
              </Button>
            </Link>
          </div>

          {/* العنوان */}
          <h1 className="text-4xl font-bold text-center mb-2">سياسة الخصوصية</h1>
          <p className="text-muted-foreground text-center">
            آخر تحديث: {new Date().toLocaleDateString('ar-SA')}
          </p>

          {/* المحتوى */}
          <div className="prose prose-lg max-w-none space-y-6 text-right pb-8" dir="rtl">
            {/* 1. المقدمة */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. المقدمة</h2>
              <p>
                تحترم «واصِل» خصوصيتك وتلتزم بحماية بياناتك الشخصية وفق أحكام القانون الاتحادي
                رقم&nbsp;45 لسنة&nbsp;2021 بشأن حماية البيانات الشخصية (PDPL).
              </p>
            </section>

            {/* 2. البيانات التي نجمعها */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">2. البيانات التي نجمعها</h2>
              <p>قد نجمع الأنواع التالية من البيانات:</p>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>
                  <strong>بيانات الحساب:</strong> البريد الإلكتروني.
                </li>
                <li>
                  <strong>محتوى الدردشات:</strong> الاستفسارات والمخرجات النصّية داخل المنصّة.
                </li>
                <li>
                  <strong>بيانات فنية تلقائية:</strong> عنوان IP، نوع المتصفّح، نظام التشغيل،
                  ملفات تعريف الارتباط، بيانات استخدام مجهولة.
                </li>
              </ul>
            </section>

            {/* 3. كيف نستخدم بياناتك */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">3. كيف نستخدم بياناتك</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>تشغيل الخدمة وتقديم نتائج البحث.</li>
                <li>تحسين الخوارزميات وتجربة المستخدم.</li>
                <li>ضمان أمان وسلامة المنصّة.</li>
                <li>إرسال رسائل تعريفية أو ترويجية عند إطلاق مزايا جديدة (مع خيار إلغاء الاشتراك).</li>
                <li>الامتثال للمتطلبات القانونية والتنظيمية.</li>
              </ul>
            </section>

            {/* 4. الاحتفاظ بالبيانات */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">4. الاحتفاظ بالبيانات</h2>
              <p>
                تُحذف الدردشات نهائيًا وبشكل فوري عند طلب المستخدم. نحتفظ بسجلات التحليلات والأخطاء
                لمدة <strong>30 يومًا</strong> ثم نحذفها أو نجهّل هويتها.
              </p>
            </section>

            {/* 5. مشاركة البيانات */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">5. مشاركة البيانات</h2>
              <p>لا نبيع بياناتك الشخصية. قد نشاركها فقط في الحالات التالية:</p>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>عند موافقتك الصريحة.</li>
                <li>للامتثال للقانون أو لأمر قضائي.</li>
                <li>لحماية حقوقنا أو سلامة المستخدمين.</li>
                <li>مع مزودي خدمات استضافة أو تحليلات يعملون كوكلاء معالجة بيانات.</li>
              </ul>
            </section>

            {/* 6. النقل الدولي للبيانات */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">6. النقل الدولي للبيانات</h2>
              <p>
                قد تتم معالجة بياناتك على خوادم خارج دولة الإمارات (مثل الاتحاد الأوروبي أو الولايات
                المتحدة). نُطبّق الضمانات المعترف بها دوليًا (بنود تعاقدية معيارية) لحماية بياناتك.
              </p>
            </section>

            {/* 7. أمن البيانات */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">7. أمن البيانات</h2>
              <p>
                نستخدم تدابير فنية وتنظيمية مناسبة – مثل التشفير والتحقق المتعدّد – لمنع الوصول غير
                المصرَّح به أو التعديل أو الفقد. رغم ذلك، لا يمكن ضمان الأمان المطلق عبر الإنترنت.
              </p>
            </section>

            {/* 8. حقوقك */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">8. حقوقك</h2>
              <p>يحق لك، وفق PDPL، ما يلي:</p>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>طلب الوصول إلى بياناتك أو تصحيحها أو حذفها.</li>
                <li>الاعتراض على المعالجة أو طلب تقييدها.</li>
                <li>سحب الموافقة في أي وقت دون التأثير على شرعية المعالجة السابقة.</li>
              </ul>
            </section>

            {/* 9. الاتصالات التسويقية */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">9. الاتصالات التسويقية</h2>
              <p>
                يُعدّ إنشاء الحساب موافقة ضمنية على تلقي رسائلنا الترويجية، مع توافر رابط إلغاء اشتراك
                واضح في كل رسالة.
              </p>
            </section>

            {/* 10. خصوصية الأطفال */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">10. خصوصية الأطفال</h2>
              <p>
                لا نجمع عمدًا بيانات أشخاص دون 13 عامًا. إذا تبيّن لنا جمع بياناتهم بالخطأ، نحذفها فورًا.
              </p>
            </section>

            {/* 11. تغييرات سياسة الخصوصية */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">11. تغييرات سياسة الخصوصية</h2>
              <p>
                قد نحدّث هذه السياسة دوريًا. سنُخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو داخل
                المنصّة.
              </p>
            </section>

            {/* 12. تواصل معنا */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">12. تواصل معنا</h2>
              <p>
                لأي طلبات تتعلق بالخصوصية، يرجى التواصل عبر:
                <br />
                <a className="text-primary hover:underline" href="mailto:info@wasel.chat">
                  info@wasel.chat
                </a>
                <br />
                سنردّ على طلبك خلال 30 يومًا كحد أقصى.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
