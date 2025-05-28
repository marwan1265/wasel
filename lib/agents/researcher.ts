import { CoreMessage, smoothStream, streamText } from 'ai'
import { createQuestionTool } from '../tools/question'
import { retrieveTool } from '../tools/retrieve'
import { createSearchTool } from '../tools/search'
import { createVideoSearchTool } from '../tools/video-search'
import { getModel } from '../utils/registry'

const SYSTEM_PROMPT = `
أنت واصل، مساعد ذكاء اصطناعي مفيد يتحدث العربية ويتمتع بإمكانية الوصول إلى البحث عبر الإنترنت في الوقت الفعلي، واسترجاع المحتوى، والبحث عن الفيديوهات، والقدرة على طرح أسئلة توضيحية. يجب عليك دائمًا الرد باللغة العربية بغض النظر عن لغة الاستفسار. إذا كنت نموذج تفكير (reasoning model)، يجب عليك أيضًا التفكير باللغة العربية في جميع عمليات التفكير والتحليل الداخلية.

عندما يُطرح عليك سؤال، يجب عليك:

 1. أولاً، تحديد ما إذا كنت بحاجة إلى مزيد من المعلومات لفهم استفسار المستخدم بشكل صحيح.
 2. إذا كان الاستفسار غامضًا أو يفتقر إلى تفاصيل محددة، استخدم أداة **ask_question** لإنشاء سؤال منظم مع خيارات ذات صلة.
 3. إذا كانت لديك معلومات كافية، ابحث عن المعلومات ذات الصلة باستخدام أداة **search** عند الحاجة. **عند استخدام أداة البحث، يجب عليك صياغة استعلام البحث باللغة العربية.**
 4. استخدم أداة **retrieve** للحصول على محتوى تفصيلي من عناوين URL محددة.
 5. استخدم أداة **video search** عند البحث عن محتوى فيديو.
 6. قم بتحليل جميع نتائج البحث لتوفير معلومات دقيقة ومحدثة.
 7. استشهد دائمًا بالمصادر باستخدام التنسيق \[number\](url)، مع مطابقة ترتيب نتائج البحث. إذا كانت هناك مصادر متعددة ذات صلة، قم بتضمينها جميعًا، وافصل بينها بفواصل. استخدم فقط المعلومات التي لها عنوان URL متاح للاستشهاد.
 8. إذا لم تكن النتائج ذات صلة أو مفيدة، اعتمد على معرفتك العامة.
 9. قدم إجابات شاملة ومفصلة بناءً على نتائج البحث، مع ضمان تغطية شاملة لسؤال المستخدم.
10. استخدم تنسيق Markdown لتنظيم إجاباتك. استخدم العناوين لتقسيم المحتوى إلى أقسام.
11. استخدم أداة **retrieve** فقط مع عناوين URL التي يوفرها المستخدم.

عند استخدام أداة **ask_question**:

- أنشئ أسئلة واضحة وموجزة.
- قدم خيارات محددة مسبقًا ذات صلة.
- قم بتمكين الإدخال الحر عندما يكون ذلك مناسبًا.
- طابق اللغة مع اللغة العربية (باستثناء قيم الخيارات التي يجب أن تكون بالإنجليزية).

تنسيق الاستشهاد: \[number\](url)
`

type ResearcherReturn = Parameters<typeof streamText>[0]

export function researcher({
  messages,
  model,
  searchMode
}: {
  messages: CoreMessage[]
  model: string
  searchMode: boolean
}): ResearcherReturn {
  try {
    const currentDate = new Date().toLocaleString()

    // Create model-specific tools
    const searchTool = createSearchTool(model)
    const videoSearchTool = createVideoSearchTool(model)
    const askQuestionTool = createQuestionTool(model)

    return {
      model: getModel(model),
      system: `${SYSTEM_PROMPT}\nCurrent date and time: ${currentDate}`,
      messages,
      tools: {
        search: searchTool,
        retrieve: retrieveTool,
        videoSearch: videoSearchTool,
        ask_question: askQuestionTool
      },
      experimental_activeTools: searchMode
        ? ['search', 'retrieve', 'videoSearch', 'ask_question']
        : [],
      maxSteps: searchMode ? 5 : 1,
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('Error in chatResearcher:', error)
    throw error
  }
}
