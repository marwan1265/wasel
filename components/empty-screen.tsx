import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

const exampleMessages = [
  {
    heading: 'ما هو DeepSeek R1؟',
    message: 'ما هو DeepSeek R1؟'
  },
  {
    heading: 'لماذا تنمو شركة Nvidia بسرعة؟',
    message: 'لماذا تنمو شركة Nvidia بسرعة؟'
  },
  {
    heading: 'تسلا مقابل ريفيان',
    message: 'تسلا مقابل ريفيان'
  },
  {
    heading: 'ملخص: https://arxiv.org/pdf/2501.05707',
    message: 'ملخص: https://arxiv.org/pdf/2501.05707'
  }
]
export function EmptyScreen({
  submitMessage,
  className
}: {
  submitMessage: (message: string) => void
  className?: string
}) {
  return (
    <div className={`mx-auto w-full transition-all ${className}`}>
      <div className="bg-background p-2">
        <div className="mt-2 flex flex-col items-start space-y-2 mb-4">
          {exampleMessages.map((message, index) => (
            <Button
              key={index}
              variant="link"
              className="h-auto p-0 text-base"
              name={message.message}
              onClick={async () => {
                submitMessage(message.message)
              }}
            >
              <ArrowLeft size={16} className="ml-2 text-muted-foreground" />
              {message.heading}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
