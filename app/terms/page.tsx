import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold text-center mb-2">شروط الخدمة</h1>
          <p className="text-muted-foreground text-center">
            آخر تحديث: {new Date().toLocaleDateString('ar-SA')}
          </p>

          {/* المحتوى */}
          <div className="prose prose-lg max-w-none space-y-6 text-right pb-8" dir="rtl">
            {/* 1. التعريفات */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. التعريفات</h2>
              <p>
                <strong>«المنصّة» أو «الخدمة»:</strong> تطبيق وخدمات البحث الذكي بالذكاء الاصطناعي المقدَّمة
                تحت اسم «واصِل».<br />
                <strong>«الشركة»:</strong> واصل تكنولوجيز (شركة منطقة حرّة قيد التأسيس في إمارة أبوظبي).<br />
                <strong>«المستخدم»:</strong> أي شخص طبيعي يبلغ 13 عامًا فأكثر يقوم بإنشاء حساب أو يستخدم المنصّة.<br />
                <strong>«المحتوى»:</strong> أي بيانات أو مواد يُنشئها المستخدم أو تُنشئها الخوارزميات نيابةً عنه داخل المنصّة.
              </p>
            </section>

            {/* 2. قبول الشروط */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">2. قبول الشروط</h2>
              <p>
                باستخدامك المنصّة، فإنك تقرّ بأنك قرأت هذه الشروط وفهمتها وتوافق على الالتزام بها وبسياسة
                الخصوصية ذات الصلة. إذا كنت لا توافق، يجب عليك التوقف عن استخدام الخدمة فورًا.
              </p>
            </section>

            {/* 3. أهلية الاستخدام */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">3. أهلية الاستخدام</h2>
              <p>
                يقتصر استخدام المنصّة على الأفراد البالغين <strong>13 سنة فأكثر</strong>. إذا كان عمرك
                بين 13 و18 سنة، فأنت تؤكد حصولك على موافقة وليّ الأمر.
              </p>
            </section>

            {/* 4. الحساب وحماية بيانات الدخول */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">4. الحساب وحماية بيانات الدخول</h2>
              <p>
                يلتزم المستخدم بتقديم بريد إلكتروني صحيح والحفاظ على سرّية بيانات الدخول. نحن لا نطّلع
                على كلمات المرور المشفّرة، لكن قد نحتفظ ببريدك الإلكتروني لأغراض التفعيل والتواصل.
              </p>
            </section>

            {/* 5. الملكية الفكرية */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">5. الملكية الفكرية</h2>
              <p>
                جميع الحقوق في اسم «واصِل» وشعاره وواجهة الاستخدام وأكواد المنصّة مملوكة لشركة واصل
                تكنولوجيز ومحميّة بموجب قوانين دولة الإمارات العربية المتحدة. «واصِل» علامة تجارية
                مسجَّلة أو قيد التسجيل.
              </p>
            </section>

            {/* 6. مخرجات الذكاء الاصطناعي */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">6. مخرجات الذكاء الاصطناعي</h2>
              <p>
                تنتقل إليك ملكية المخرجات النصّية التي تُنشئها عبر المنصّة، مع منحك للشركة ترخيصًا
                دوليًّا دائمًا وخاليًا من الرسوم لاستخدام تلك المخرجات بالقدر اللازم لتشغيل الخدمة
                وتحسينها والامتثال للمتطلبات القانونية.
              </p>
            </section>

            {/* 7. الاستخدام المقبول والمحتوى المحظور */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">7. الاستخدام المقبول والمحتوى المحظور</h2>
              <p>يُحظر على المستخدم:</p>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>نشر أو توليد محتوى يحضّ على الكراهية أو التطرف السياسي.</li>
                <li>تقديم طلبات تُشكّل تهديدًا للأمن الوطني أو السلامة العامة.</li>
                <li>انتهاك حقوق الملكية الفكرية أو الخصوصية للغير.</li>
                <li>محاولة اختراق أو تعطيل الخدمة بأي وسيلة.</li>
              </ul>
              <p>
                تحتفظ الشركة بالحق في حظر الحسابات المخالفة أو إبلاغ السلطات المختصّة متى لزم الأمر.
              </p>
            </section>

            {/* 8. تعليق الخدمة أو إنهاؤها */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">8. تعليق الخدمة أو إنهاؤها</h2>
              <p>
                يجوز لنا تعليق أو إنهاء حسابك فورًا ودون إشعار إذا خالفت هذه الشروط أو أي قوانين سارية.
              </p>
            </section>

            {/* 9. إخلاء المسؤولية */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">9. إخلاء المسؤولية</h2>
              <p>
                تُقدَّم المنصّة «كما هي» ودون أي ضمانات صريحة أو ضمنية. قد تتضمن نتائج البحث أخطاء أو
                معلومات غير دقيقة، ولا نتحمل مسؤولية أي أضرار ناشئة عن استخدامها.
              </p>
            </section>

            {/* 10. حدود المسؤولية */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">10. حدود المسؤولية</h2>
              <p>
                إلى أقصى حد يسمح به القانون، لا تتحمل الشركة أي مسؤولية عن الأضرار غير المباشرة أو
                التبعية أو فقد البيانات الناتج عن استخدام المنصّة.
              </p>
            </section>

            {/* 11. القانون الحاكم وتسوية المنازعات */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">11. القانون الحاكم وتسوية المنازعات</h2>
              <p>
                تخضع هذه الشروط لقوانين دولة الإمارات العربية المتحدة، ويكون الاختصاص الحصري لمحاكم
                أبوظبي ما لم يُتفق كتابيًا على التحكيم في مركز تحكيم أبوظبي.
              </p>
            </section>

            {/* 12. التعديلات */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">12. التعديلات</h2>
              <p>
                يجوز لنا تعديل هذه الشروط في أي وقت. سيتم إخطارك بالتغييرات الجوهرية عبر البريد
                الإلكتروني أو عند تسجيل الدخول، ويُعد استمرارك في الاستخدام قبولًا للشروط المحدثة.
              </p>
            </section>

            {/* 13. التواصل */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">13. التواصل</h2>
              <p>
                لأي استفسارات أو شكاوى، يرجى التواصل عبر البريد الإلكتروني:
                <br />
                <a className="text-primary hover:underline" href="mailto:info@wasel.chat">
                  info@wasel.chat
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
