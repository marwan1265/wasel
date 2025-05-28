import { CoreMessage, smoothStream, streamText } from 'ai'
import { getModel } from '../utils/registry'

const BASE_SYSTEM_PROMPT = `
أنت واصل، مساعد ذكاء اصطناعي مفيد يتحدث العربية ويقدم معلومات دقيقة. يجب عليك دائمًا الرد باللغة العربية بغض النظر عن لغة الاستفسار. إذا كنت نموذج تفكير (reasoning model)، يجب عليك أيضًا التفكير باللغة العربية في جميع عمليات التفكير والتحليل الداخلية.

عند الرد على أسئلة المستخدم، يجب عليك:

1. تقديم إجابات شاملة ومفصلة لأسئلة المستخدم.
2. استخدام تنسيق Markdown لتنظيم إجاباتك مع استخدام العناوين المناسبة.
3. الإقرار عندما تكون غير متأكد من تفاصيل معينة.
4. التركيز على الحفاظ على دقة عالية في إجاباتك.
`

const SEARCH_ENABLED_PROMPT = `
${BASE_SYSTEM_PROMPT}

عند تحليل نتائج البحث:

1. قم بتحليل نتائج البحث المقدمة بعناية للإجابة على سؤال المستخدم.
2. استشهد دائمًا بالمصادر باستخدام التنسيق \[number\](url)، مع مطابقة ترتيب نتائج البحث.
3. إذا كانت هناك مصادر متعددة ذات صلة، قم بتضمينها جميعًا باستخدام استشهادات مفصولة بفواصل.
4. استخدم فقط المعلومات التي لها عنوان URL متاح للاستشهاد.
5. إذا لم تحتوي نتائج البحث على معلومات ذات صلة، أقر بذلك وقدم إجابة عامة بناءً على معرفتك.

تنسيق الاستشهاد: \[number\](url)
`

const SEARCH_DISABLED_PROMPT = `
${BASE_SYSTEM_PROMPT}

مهم:
1. قدم الإجابات بناءً على معرفتك العامة.
2. كن واضحًا بشأن أي قيود في معرفتك.
3. اقترح متى قد يكون البحث عن معلومات إضافية مفيدًا.
`

interface ManualResearcherConfig {
  messages: CoreMessage[]
  model: string
  isSearchEnabled?: boolean
}

type ManualResearcherReturn = Parameters<typeof streamText>[0]

export function manualResearcher({
  messages,
  model,
  isSearchEnabled = true
}: ManualResearcherConfig): ManualResearcherReturn {
  try {
    const currentDate = new Date().toLocaleString()
    const systemPrompt = isSearchEnabled
      ? SEARCH_ENABLED_PROMPT
      : SEARCH_DISABLED_PROMPT

    return {
      model: getModel(model),
      system: `${systemPrompt}\nCurrent date and time: ${currentDate}`,
      messages,
      temperature: 0.6,
      topP: 1,
      topK: 40,
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('Error in manualResearcher:', error)
    throw error
  }
}
