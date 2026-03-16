export type User = {
  name: string
  email: string
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatSession = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  folderId?: string | null
  threadId?: string
  messages: ChatMessage[]
}

export type ChatFolder = {
  id: string
  name: string
  createdAt: string
}
