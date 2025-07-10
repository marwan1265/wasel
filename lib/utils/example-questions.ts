interface ExampleQuestion {
  id: string
  heading: string
  message: string
}

interface ExampleQuestionsConfig {
  questions: ExampleQuestion[]
  displayCount: number
  randomize: boolean
}

// Fallback questions in case JSON fails to load
const fallbackQuestions: ExampleQuestion[] = [
  {
    id: '1',
    heading: 'ما هو DeepSeek R1؟',
    message: 'ما هو DeepSeek R1؟'
  },
  {
    id: '2',
    heading: 'لماذا تنمو شركة Nvidia بسرعة؟',
    message: 'لماذا تنمو شركة Nvidia بسرعة؟'
  },
  {
    id: '3',
    heading: 'تسلا مقابل ريفيان',
    message: 'تسلا مقابل ريفيان'
  },
  {
    id: '4',
    heading: 'ملخص: https://arxiv.org/pdf/2501.05707',
    message: 'ملخص: https://arxiv.org/pdf/2501.05707'
  }
]

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Loads example questions from JSON config and returns a randomized subset
 */
export async function getExampleQuestions(): Promise<ExampleQuestion[]> {
  try {
    const response = await fetch('/config/example-questions.json')
    
    if (!response.ok) {
      console.warn('Failed to fetch example questions config, using fallback')
      return fallbackQuestions
    }
    
    const config: ExampleQuestionsConfig = await response.json()
    
    if (!config.questions || !Array.isArray(config.questions)) {
      console.warn('Invalid questions format in config, using fallback')
      return fallbackQuestions
    }
    
    const questions = config.questions
    const displayCount = config.displayCount || 4
    const shouldRandomize = config.randomize !== false
    
    if (!shouldRandomize) {
      return questions.slice(0, displayCount)
    }
    
    // Randomize and return subset
    const shuffledQuestions = shuffleArray(questions)
    return shuffledQuestions.slice(0, Math.min(displayCount, shuffledQuestions.length))
    
  } catch (error) {
    console.error('Error loading example questions:', error)
    return fallbackQuestions
  }
}

export type { ExampleQuestion }
