import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ChangeEvent, DragEvent, MouseEvent } from 'react'
import { API_BASE_URL } from '../config'
import type { ChatFolder, ChatMessage, ChatSession, User } from '../types'
import { useVoiceSettings } from '../components/layout/VoiceSettingsContext'

type ChatState = {
  sessions: ChatSession[]
  folders: ChatFolder[]
  activeSessionId: string | null
}

function deriveTitleFromMessage(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return 'New chat'
  if (trimmed.length <= 30) return trimmed
  return `${trimmed.slice(0, 27)}...`
}

type ChatPageProps = {
  user: User
}

type BrowserSpeechRecognition = {
  new (): {
    lang: string
    interimResults: boolean
    continuous: boolean
    onstart: (() => void) | null
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: (() => void) | null
    onend: (() => void) | null
    start: () => void
    stop: () => void
  }
}

type SpeechRecognitionEvent = {
  results: {
    0: { transcript: string }
    length: number
  }[]
}

export default function ChatPage({ user }: ChatPageProps) {
  const storageKey = `chat_sessions_v1_${user.email}`

  const [chatState, setChatState] = useState<ChatState>(() => {
    if (typeof window === 'undefined') {
      return { sessions: [], folders: [], activeSessionId: null }
    }

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return { sessions: [], folders: [], activeSessionId: null }
      const parsed = JSON.parse(raw) as ChatState
      if (!parsed || typeof parsed !== 'object') {
        return { sessions: [], folders: [], activeSessionId: null }
      }
      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        folders: Array.isArray(parsed.folders) ? parsed.folders : [],
        activeSessionId: parsed.activeSessionId || null
      }
    } catch {
      return { sessions: [], folders: [], activeSessionId: null }
    }
  })
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [composerFocused, setComposerFocused] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    if (typeof window === 'undefined') return 'en'
    try {
      const stored = window.localStorage.getItem(`chat_language_${user.email}`)
      return stored || 'en'
    } catch {
      return 'en'
    }
  })
  const [showRegionalLanguages, setShowRegionalLanguages] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [openSessionMenuId, setOpenSessionMenuId] = useState<string | null>(null)
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null)
  const [collapsedFolders, setCollapsedFolders] = useState<string[]>([])
  const [rootCollapsed, setRootCollapsed] = useState(false)
  const [dragOverGroup, setDragOverGroup] = useState<string | 'root' | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [listeningMessage, setListeningMessage] = useState<string | null>(null)
  const [lastVoiceInput, setLastVoiceInput] = useState<string | null>(null)
  const [ttsVoiceLabel, setTtsVoiceLabel] = useState('Auto')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const listeningTimeoutRef = useRef<number | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsAudioUrlRef = useRef<string | null>(null)
  const voiceSettings = useVoiceSettings()

  const activeSession = useMemo(
    () => {
      if (chatState.sessions.length === 0) return undefined
      return chatState.sessions.find((s) => s.id === chatState.activeSessionId) ?? chatState.sessions[0]
    },
    [chatState]
  )

  const messages = activeSession?.messages ?? []

  const updateChatState = useCallback((updater: (prev: ChatState) => ChatState) => {
    setChatState((prev) => {
      const next = updater(prev)
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }, [storageKey])

  async function persistMessages(sessionId: string, messagesToSave: ChatMessage[]) {
    try {
      await fetch(`${API_BASE_URL}/api/chat/sessions/save-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.email, sessionId, messages: messagesToSave })
      })
    } catch (error) {
      console.error('Failed to save chat messages', error)
    }
  }

  useEffect(() => {
    async function initializeFromBackend() {
      setInitialLoading(true)
      setLoadError(null)

      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/sessions/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.email, includeMessages: true })
        })

        if (!response.ok) {
          throw new Error('Failed to load chat sessions')
        }

        const data = await response.json()
        const folders: ChatFolder[] = data?.data?.folders || []
        const sessions: ChatSession[] = data?.data?.sessions || []

        if (!sessions.length) {
          const greeting: ChatMessage = {
            role: 'assistant',
            content: 'Hi, I am your reAct Agent assistant. Ask me anything.'
          }

          const createResponse = await fetch(`${API_BASE_URL}/api/chat/sessions/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.email,
              title: 'New chat',
              messages: [greeting]
            })
          })

          if (!createResponse.ok) {
            throw new Error('Failed to create initial chat session')
          }

          const createData = await createResponse.json()
          const session: ChatSession = createData?.data?.session

          updateChatState(() => ({
            sessions: session ? [session] : [],
            folders,
            activeSessionId: session?.id || null
          }))
        } else {
          updateChatState(() => ({
            sessions,
            folders,
            activeSessionId: sessions[0]?.id || null
          }))
        }
      } catch (error) {
        console.error(error)
        setLoadError('Failed to load your chats. Please refresh or try again later.')
        updateChatState(() => ({ sessions: [], folders: [], activeSessionId: null }))
      } finally {
        setInitialLoading(false)
      }
    }

    void initializeFromBackend()
  }, [user.email, updateChatState])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const voiceIdKey = `tts_voice_id_${user.email}`
      const stored = window.localStorage.getItem(voiceIdKey)
      setTtsVoiceLabel(stored || 'Auto')
    } catch {
      setTtsVoiceLabel('Auto')
    }
  }, [user.email])

  async function handleNewChat(folderId: string | null = null) {
    const greeting: ChatMessage = {
      role: 'assistant',
      content: 'Hi, I am your reAct Agent assistant. Ask me anything.'
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/sessions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.email,
          title: 'New chat',
          folderId,
          messages: [greeting]
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create chat session')
      }

      const data = await response.json()
      const session: ChatSession = data?.data?.session

      if (!session) return

      updateChatState((prev) => ({
        sessions: [session, ...prev.sessions],
        folders: prev.folders,
        activeSessionId: session.id
      }))

      setInput('')
      setSelectedFile(null)
    } catch (error) {
      console.error(error)
      setLoadError('Failed to start a new chat. Please try again.')
    }
  }

  async function handleNewFolder() {
    const name = window.prompt('Folder / project name')?.trim()
    if (!name) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/folders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.email, name })
      })

      if (!response.ok) {
        throw new Error('Failed to create folder')
      }

      const data = await response.json()
      const folder: ChatFolder = data?.data?.folder
      if (!folder) return

      updateChatState((prev) => ({
        ...prev,
        folders: [...prev.folders, folder]
      }))
    } catch (error) {
      console.error(error)
      setLoadError('Failed to create folder. Please try again.')
    }
  }

  function toggleFolderCollapse(folderId: string) {
    setCollapsedFolders((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    )
  }

  function toggleRootCollapse() {
    setRootCollapsed((prev) => !prev)
  }

  function toggleFolderMenu(folderId: string, event: MouseEvent) {
    event.stopPropagation()
    setOpenSessionMenuId(null)
    setOpenFolderMenuId((prev) => (prev === folderId ? null : folderId))
  }

  function toggleSessionMenu(sessionId: string, event: MouseEvent) {
    event.stopPropagation()
    setOpenFolderMenuId(null)
    setOpenSessionMenuId((prev) => (prev === sessionId ? null : sessionId))
  }

  async function handleRenameSession(sessionId: string) {
    const session = chatState.sessions.find((s) => s.id === sessionId)
    const currentTitle = session?.title || 'Chat'
    const nextTitle = window.prompt('Rename chat', currentTitle)?.trim()
    if (!nextTitle) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/sessions/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.email, sessionId, title: nextTitle })
      })

      if (!response.ok) {
        throw new Error('Failed to rename chat')
      }

      const data = await response.json()
      const updatedSession: ChatSession = data?.data?.session

      updateChatState((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => (s.id === sessionId ? updatedSession : s))
      }))
    } catch (error) {
      console.error(error)
      setLoadError('Failed to rename chat. Please try again.')
    }
  }

  async function handleRenameFolder(folderId: string) {
    const folder = chatState.folders.find((f) => f.id === folderId)
    const currentName = folder?.name || 'Folder'
    const nextName = window.prompt('Rename folder', currentName)?.trim()
    if (!nextName) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/folders/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.email, folderId, name: nextName })
      })

      if (!response.ok) {
        throw new Error('Failed to rename folder')
      }

      const data = await response.json()
      const updatedFolder: ChatFolder = data?.data?.folder

      updateChatState((prev) => ({
        ...prev,
        folders: prev.folders.map((f) => (f.id === folderId ? updatedFolder : f))
      }))
    } catch (error) {
      console.error(error)
      setLoadError('Failed to rename folder. Please try again.')
    }
  }

  async function handleDeleteFolder(folderId: string) {
    const confirmed = window.confirm(
      'Delete this project and all chats inside it? This cannot be undone.'
    )
    if (!confirmed) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/folders/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.email, folderId })
      })

      if (!response.ok) {
        throw new Error('Failed to delete folder')
      }

      updateChatState((prev) => {
        const remainingFolders = prev.folders.filter((f) => f.id !== folderId)
        const remainingSessions = prev.sessions.filter((s) => s.folderId !== folderId)

        let nextActiveId = prev.activeSessionId
        if (nextActiveId && !remainingSessions.some((s) => s.id === nextActiveId)) {
          nextActiveId = remainingSessions[0]?.id ?? null
        }

        return {
          ...prev,
          folders: remainingFolders,
          sessions: remainingSessions,
          activeSessionId: nextActiveId
        }
      })
    } catch (error) {
      console.error(error)
      setLoadError('Failed to delete folder. Please try again.')
    } finally {
      setOpenFolderMenuId((prev) => (prev === folderId ? null : prev))
    }
  }

  async function handleMoveSession(sessionId: string, targetFolderId: string | null) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/sessions/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.email, sessionId, folderId: targetFolderId })
      })

      if (!response.ok) {
        throw new Error('Failed to move chat')
      }

      const data = await response.json()
      const updatedSession: ChatSession = data?.data?.session

      updateChatState((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => (s.id === sessionId ? updatedSession : s))
      }))
    } catch (error) {
      console.error(error)
      setLoadError('Failed to move chat. Please try again.')
    }
  }

  function handleSelectSession(sessionId: string) {
    updateChatState((prev) => ({
      ...prev,
      activeSessionId: sessionId
    }))

    setInput('')
    setSelectedFile(null)
  }

  function handleSessionDragStart(event: DragEvent<HTMLDivElement>, sessionId: string) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', sessionId)
  }

  function handleSessionDragEnd() {
    setDragOverGroup(null)
  }

  function handleFolderDragOver(event: DragEvent<HTMLDivElement>, folderId: string | 'root') {
    event.preventDefault()
    setDragOverGroup(folderId)
  }

  function handleFolderDragLeave(folderId: string | 'root') {
    if (dragOverGroup === folderId) {
      setDragOverGroup(null)
    }
  }

  function handleFolderDrop(event: DragEvent<HTMLDivElement>, folderId: string | 'root') {
    event.preventDefault()
    const sessionId = event.dataTransfer.getData('text/plain')
    if (!sessionId) return
    const targetFolderId = folderId === 'root' ? null : folderId
    void handleMoveSession(sessionId, targetFolderId)
    setDragOverGroup(null)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
  }

  function startListening() {
    if (isListening) {
      stopListening()
      return
    }

    const SpeechRecognitionClass: BrowserSpeechRecognition | undefined =
      (window as unknown as { SpeechRecognition?: BrowserSpeechRecognition; webkitSpeechRecognition?: BrowserSpeechRecognition })
        .SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: BrowserSpeechRecognition; webkitSpeechRecognition?: BrowserSpeechRecognition })
        .webkitSpeechRecognition

    if (!SpeechRecognitionClass) {
      setListeningMessage('Voice input is not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognitionClass()
    recognition.lang = selectedLanguage === 'hi' ? 'hi-IN' : 'en-US'
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onstart = () => {
      setIsListening(true)
      setListeningMessage('Listening… please speak now.')
      if (listeningTimeoutRef.current) {
        window.clearTimeout(listeningTimeoutRef.current)
      }
      listeningTimeoutRef.current = window.setTimeout(() => {
        if (isListening) {
          setListeningMessage("We didn't catch that. Please try again.")
          recognition.stop()
        }
      }, 8000)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript
      }
      setInput(transcript)
      setLastVoiceInput(transcript)
      setListeningMessage('Preview your query above, then send when ready.')
    }

    recognition.onerror = () => {
      setListeningMessage('Voice input error. Please try again.')
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      if (!listeningMessage) {
        setListeningMessage('Stopped listening.')
      }
      if (listeningTimeoutRef.current) {
        window.clearTimeout(listeningTimeoutRef.current)
        listeningTimeoutRef.current = null
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
    if (listeningTimeoutRef.current) {
      window.clearTimeout(listeningTimeoutRef.current)
      listeningTimeoutRef.current = null
    }
  }

  async function handleDeleteSession(sessionId: string) {
    const confirmed = window.confirm('Delete this chat? This cannot be undone.')
    if (!confirmed) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/sessions/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.email, sessionId })
      })

      if (!response.ok) {
        throw new Error('Failed to delete chat')
      }

      updateChatState((prev) => {
        const remainingSessions = prev.sessions.filter((s) => s.id !== sessionId)
        let nextActiveId = prev.activeSessionId
        if (nextActiveId === sessionId) {
          nextActiveId = remainingSessions[0]?.id ?? null
        }

        return {
          ...prev,
          sessions: remainingSessions,
          activeSessionId: nextActiveId
        }
      })
    } catch (error) {
      console.error(error)
      setLoadError('Failed to delete chat. Please try again.')
    } finally {
      setOpenSessionMenuId((prev) => (prev === sessionId ? null : prev))
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    const text = input.trim()
    if (!text || loading || !activeSession) return

    const userContent = selectedFile
      ? `📎 ${selectedFile.name}\n\n${text}`
      : text

    const userMessage: ChatMessage = { role: 'user', content: userContent }
    const nowIso = new Date().toISOString()

    let threadId = activeSession.threadId
    if (!threadId) {
      threadId = `web-${Date.now()}`
    }

    const updatedMessagesForUser: ChatMessage[] = [...(activeSession.messages || []), userMessage]

    updateChatState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== activeSession.id) return s
        return {
          ...s,
          threadId,
          updatedAt: nowIso,
          title: s.title === 'New chat' ? deriveTitleFromMessage(text) : s.title,
          messages: updatedMessagesForUser
        }
      })
    }))

    void persistMessages(activeSession.id, updatedMessagesForUser)

    setInput('')
    setLoading(true)

    try {
      let content: string

      if (selectedFile) {
        const formData = new FormData()
        formData.append('threadId', threadId)
        formData.append('message', text)
        formData.append('file', selectedFile)
        formData.append('language', selectedLanguage)

        const response = await fetch(`${API_BASE_URL}/api/agent/file-query`, {
          method: 'POST',
          body: formData
        })

        if (!response.ok) throw new Error('Failed to fetch assistant response for file query')

        const data = await response.json()
        content = data?.data?.response || 'No response received.'
      } else {
        const response = await fetch(`${API_BASE_URL}/api/agent/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId, message: text, language: selectedLanguage })
        })

        if (!response.ok) throw new Error('Failed to fetch assistant response')

        const data = await response.json()
        content = data?.data?.response || 'No response received.'
      }

      const assistantMessage: ChatMessage = { role: 'assistant', content }
      const responseTime = new Date().toISOString()
      const updatedMessagesWithAssistant: ChatMessage[] = [
        ...(activeSession.messages || []),
        userMessage,
        assistantMessage
      ]

      updateChatState((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => {
          if (s.id !== activeSession.id) return s
          return {
            ...s,
            updatedAt: responseTime,
            messages: updatedMessagesWithAssistant
          }
        })
      }))

      void persistMessages(activeSession.id, updatedMessagesWithAssistant)
    } catch {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content:
          'Backend is unavailable right now or file queries are not supported yet. Please ensure the Fastify API is running on port 3001.'
      }

      const updatedMessagesWithError: ChatMessage[] = [
        ...(activeSession.messages || []),
        userMessage,
        errorMessage
      ]

      updateChatState((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => {
          if (s.id !== activeSession.id) return s
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            messages: updatedMessagesWithError
          }
        })
      }))

      void persistMessages(activeSession.id, updatedMessagesWithError)
    } finally {
      setLoading(false)
      setSelectedFile(null)
      setLastVoiceInput(null)
    }
  }

  const sessionsByFolder = useMemo(() => {
    const byFolder: Record<string, ChatSession[]> = {}
    const root: ChatSession[] = []

    for (const s of chatState.sessions) {
      if (!s.folderId) {
        root.push(s)
      } else {
        if (!byFolder[s.folderId]) byFolder[s.folderId] = []
        byFolder[s.folderId].push(s)
      }
    }

    return { byFolder, root }
  }, [chatState.sessions])

  function handleLanguageChange(languageCode: string) {
    setSelectedLanguage(languageCode)
    try {
      window.localStorage.setItem(`chat_language_${user.email}`, languageCode)
    } catch {
      // ignore storage errors
    }
  }

  async function speakLastReply() {
    if (isSpeaking) {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause()
        ttsAudioRef.current.currentTime = 0
      }
      setIsSpeaking(false)
      return
    }

    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (!lastAssistant) return

    try {
      setIsSpeaking(true)

      let preferredVoiceId: string | null = null
      let gender: 'auto' | 'male' | 'female' = 'auto'
      let ageTone: 'auto' | 'young' | 'mature' = 'auto'
      if (typeof window !== 'undefined') {
        try {
          const voiceIdKey = `tts_voice_id_${user.email}`
          const genderKey = `tts_voice_gender_${user.email}`
          const ageKey = `tts_voice_age_${user.email}`

          preferredVoiceId = window.localStorage.getItem(voiceIdKey)
          const storedGender = window.localStorage.getItem(genderKey) as
            | 'auto'
            | 'male'
            | 'female'
            | null
          const storedAge = window.localStorage.getItem(ageKey) as
            | 'auto'
            | 'young'
            | 'mature'
            | null

          gender = storedGender || 'auto'
          ageTone = storedAge || 'auto'
        } catch {
          // ignore storage errors
        }
      }

      function getDefaultVoiceId(
        g: 'auto' | 'male' | 'female',
        a: 'auto' | 'young' | 'mature'
      ): string {
        if (g === 'female') {
          if (a === 'young') return 'verse' // brighter female
          if (a === 'mature') return 'coral' // warmer female
          return 'coral'
        }
        if (g === 'male') {
          if (a === 'young') return 'ash' // brighter male
          if (a === 'mature') return 'ballad' // deeper male
          return 'ballad'
        }
        // auto gender
        if (a === 'young') return 'ash'
        if (a === 'mature') return 'coral'
        return 'alloy'
      }

      const effectiveVoiceId = preferredVoiceId || getDefaultVoiceId(gender, ageTone)

      const response = await fetch(`${API_BASE_URL}/api/voice/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: lastAssistant.content,
          language: selectedLanguage,
          voice: effectiveVoiceId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to synthesize speech')
      }

      const blob = await response.blob()

      if (ttsAudioUrlRef.current) {
        URL.revokeObjectURL(ttsAudioUrlRef.current)
        ttsAudioUrlRef.current = null
      }

      const url = URL.createObjectURL(blob)
      ttsAudioUrlRef.current = url

      const audio = new Audio(url)
      ttsAudioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
      }

      await audio.play()
    } catch (error) {
      console.error('Failed to play TTS audio', error)
      setIsSpeaking(false)
    }
  }

  useEffect(() => {
    return () => {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause()
        ttsAudioRef.current = null
      }
      if (ttsAudioUrlRef.current) {
        URL.revokeObjectURL(ttsAudioUrlRef.current)
        ttsAudioUrlRef.current = null
      }
    }
  }, [])

  return (
    <section className="chat-page">
      {initialLoading && <p className="muted">Loading your chats...</p>}
      {loadError && !initialLoading && <p className="muted">{loadError}</p>}
      <div className="chat-layout">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2>Sessions</h2>
            <button type="button" className="tiny-btn" onClick={() => handleNewChat(null)}>
              New Chat
            </button>
          </div>

          <input
            type="text"
            className="sidebar-search"
            placeholder="Search projects or chats..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          <button type="button" className="tiny-outline-btn" onClick={handleNewFolder}>
            + New Folder / Project
          </button>

          <div className="chat-sidebar-list">
            {chatState.folders.map((folder) => {
              const folderSessions = sessionsByFolder.byFolder[folder.id] || []
              const query = searchQuery.trim().toLowerCase()
              const visibleFolderSessions = query
                ? folderSessions.filter((session) =>
                    (session.title || 'Untitled chat').toLowerCase().includes(query)
                  )
                : folderSessions
              const folderMatchesQuery = query
                ? folder.name.toLowerCase().includes(query)
                : true

              if (query && !folderMatchesQuery && visibleFolderSessions.length === 0) {
                return null
              }
              return (
                <div key={folder.id} className="folder-block">
                  <div className="folder-header">
                    <button
                      type="button"
                      className="folder-toggle"
                      onClick={() => toggleFolderCollapse(folder.id)}
                    >
                      <span
                        className={`chevron ${collapsedFolders.includes(folder.id) ? 'collapsed' : ''}`}
                      >
                        ▾
                      </span>
                      <span className="folder-name">📁 {folder.name}</span>
                    </button>
                    <div className="folder-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleNewChat(folder.id)
                        }}
                      >
                        +
                      </button>
                      <div className="menu-wrap">
                        <button
                          type="button"
                          className="icon-btn menu-trigger"
                          onClick={(event) => toggleFolderMenu(folder.id, event)}
                        >
                          ⋯
                        </button>
                        {openFolderMenuId === folder.id && (
                          <div className="menu">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenFolderMenuId(null)
                                void handleRenameFolder(folder.id)
                              }}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void handleDeleteFolder(folder.id)
                              }}
                            >
                              Delete project
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {!collapsedFolders.includes(folder.id) && visibleFolderSessions.length > 0 && (
                    <div
                      className={`session-list droppable ${
                        dragOverGroup === folder.id ? 'drag-over' : ''
                      }`}
                      onDragOver={(event) => handleFolderDragOver(event, folder.id)}
                      onDragLeave={() => handleFolderDragLeave(folder.id)}
                      onDrop={(event) => handleFolderDrop(event, folder.id)}
                    >
                      {visibleFolderSessions.map((session) => (
                        <div
                          key={session.id}
                          className={`session-item ${
                            session.id === activeSession?.id ? 'active' : ''
                          }`}
                          draggable
                          onDragStart={(event) => handleSessionDragStart(event, session.id)}
                          onDragEnd={handleSessionDragEnd}
                          onClick={() => handleSelectSession(session.id)}
                        >
                          <div className="session-title">{session.title || 'Untitled chat'}</div>
                          <div className="menu-wrap">
                            <button
                              type="button"
                              className="icon-btn menu-trigger"
                              onClick={(event) => toggleSessionMenu(session.id, event)}
                            >
                              ⋯
                            </button>
                            {openSessionMenuId === session.id && (
                              <div className="menu">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenSessionMenuId(null)
                                    void handleRenameSession(session.id)
                                  }}
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleDeleteSession(session.id)
                                  }}
                                >
                                  Delete chat
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {(() => {
              const query = searchQuery.trim().toLowerCase()
              const rootSessions = sessionsByFolder.root
              const visibleRootSessions = query
                ? rootSessions.filter((session) =>
                    (session.title || 'Untitled chat').toLowerCase().includes(query)
                  )
                : rootSessions

              if (!visibleRootSessions.length) {
                return null
              }

              return (
              <div className="folder-block">
                <div className="folder-header root-header">
                  <button
                    type="button"
                    className="folder-toggle"
                    onClick={toggleRootCollapse}
                  >
                    <span className={`chevron ${rootCollapsed ? 'collapsed' : ''}`}>
                      ▾
                    </span>
                    <span className="folder-name">⭐ Default</span>
                  </button>
                </div>
                {!rootCollapsed && (
                  <div
                    className={`session-list droppable ${
                      dragOverGroup === 'root' ? 'drag-over' : ''
                    }`}
                    onDragOver={(event) => handleFolderDragOver(event, 'root')}
                    onDragLeave={() => handleFolderDragLeave('root')}
                    onDrop={(event) => handleFolderDrop(event, 'root')}
                  >
                    {visibleRootSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`session-item ${
                          session.id === activeSession?.id ? 'active' : ''
                        }`}
                        draggable
                        onDragStart={(event) => handleSessionDragStart(event, session.id)}
                        onDragEnd={handleSessionDragEnd}
                        onClick={() => handleSelectSession(session.id)}
                      >
                        <div className="session-title">{session.title || 'Untitled chat'}</div>
                        <div className="menu-wrap">
                          <button
                            type="button"
                            className="icon-btn menu-trigger"
                            onClick={(event) => toggleSessionMenu(session.id, event)}
                          >
                            ⋯
                          </button>
                          {openSessionMenuId === session.id && (
                            <div className="menu">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenSessionMenuId(null)
                                  void handleRenameSession(session.id)
                                }}
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleDeleteSession(session.id)
                                }}
                              >
                                Delete chat
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )
            })()}
          </div>
        </aside>

        <div className="chat-main">
          <h1>Chat Screen</h1>
          <p className="muted">
            Talk to your assistant in a simple and friendly chat experience. Organize your chats into
            projects and attach files to ask questions.
          </p>

          <div className="chat-box">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`bubble ${message.role}`}>
                {message.content}
              </div>
            ))}
            {loading && (
              <div className="bubble assistant thinking">
                <div className="thinking-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="thinking-text">Thinking…</span>
              </div>
            )}
            {isListening && (
              <div className="bubble system listening">
                <div className="listening-wave" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="listening-text">Listening… speak your query.</span>
              </div>
            )}
            {listeningMessage && !isListening && (
              <div className="bubble system listening-message">
                {listeningMessage}
              </div>
            )}
          </div>

          {lastVoiceInput && (
            <div className="voice-preview">
              <div className="voice-preview-label">Voice draft (editable above):</div>
              <div className="voice-preview-text">{lastVoiceInput}</div>
            </div>
          )}

          <div className="language-selector">
            <span className="language-label">Reply language:</span>
            <button
              type="button"
              className={`lang-pill ${selectedLanguage === 'en' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('en')}
            >
              English
            </button>
            <button
              type="button"
              className={`lang-pill ${selectedLanguage === 'hi' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('hi')}
            >
              Hindi
            </button>
            <button
              type="button"
              className={`lang-pill toggle ${showRegionalLanguages ? 'open' : ''}`}
              onClick={() => setShowRegionalLanguages((prev) => !prev)}
            >
              Regional languages {showRegionalLanguages ? '▴' : '▾'}
            </button>
          </div>

          {showRegionalLanguages && (
            <div className="language-regional-list">
              {[
                { code: 'bn', label: 'Bengali' },
                { code: 'gu', label: 'Gujarati' },
                { code: 'mr', label: 'Marathi' },
                { code: 'ta', label: 'Tamil' },
                { code: 'te', label: 'Telugu' },
                { code: 'kn', label: 'Kannada' },
                { code: 'ml', label: 'Malayalam' },
                { code: 'pa', label: 'Punjabi' }
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={`lang-pill regional ${selectedLanguage === lang.code ? 'active' : ''}`}
                  onClick={() => handleLanguageChange(lang.code)}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}

          {selectedFile && (
            <div className="attachment-pill">
              <span className="attachment-name">📎 {selectedFile.name}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedFile(null)}
              >
                ✕
              </button>
            </div>
          )}

          <form className="chat-input" onSubmit={sendMessage}>
            <label className="attach-btn">
              📎
              <input type="file" onChange={handleFileChange} />
            </label>
            <button
              type="button"
              className={`icon-btn mic-btn ${isListening ? 'active' : ''}`}
              onClick={startListening}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              title={isListening ? 'Stop voice input' : 'Start voice input'}
            >
              {isListening ? '◼' : '🎤'}
            </button>
            <input
              className="composer-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setLastVoiceInput(null)
              }}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              placeholder={selectedFile ? 'Ask a question about the attached file...' : 'Type your message...'}
            />
            <button
              type="submit"
              className={`send-btn ${composerFocused ? 'focused' : ''} ${loading ? 'loading' : ''}`}
              disabled={loading}
              aria-label="Send message"
            >
              {loading ? <span className="send-spinner" aria-hidden="true" /> : <span className="send-icon">➤</span>}
            </button>
            <button
              type="button"
              className="icon-btn tts-btn"
              onClick={speakLastReply}
              aria-label={isSpeaking ? 'Stop reading reply' : 'Read last reply aloud'}
              title={isSpeaking ? 'Stop reading reply' : 'Read last reply aloud'}
            >
              {isSpeaking ? '◼' : '🔊'}
            </button>
            <button
              type="button"
              className="icon-btn voice-artist-btn"
              onClick={() => voiceSettings?.openVoiceSettings()}
              aria-label="Change voice artist"
              title={`Change voice artist (current: ${ttsVoiceLabel})`}
            >
              ⋯
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
