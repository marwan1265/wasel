import { Chat } from '@/components/chat'
import { getModels } from '@/lib/config/models'
// import { generateId } from 'ai'
import { v4 as uuidv4 } from 'uuid'

export default async function Page() {
  // const id = generateId()
  const id = uuidv4()
  const models = await getModels()
  return <Chat id={id} models={models} />
}
