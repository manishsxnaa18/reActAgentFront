import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '../../types'
import { getInitials } from '../../utils/user'
import { VoiceSettingsContext } from './VoiceSettingsContext'
import { API_BASE_URL } from '../../config'

type ServerVoice = {
  id: string
  label: string
  gender: 'male' | 'female' | 'neutral'
}

const SERVER_VOICES: ServerVoice[] = [
  { id: 'alloy', label: 'Alloy (neutral)', gender: 'neutral' },
  { id: 'ash', label: 'Ash (male)', gender: 'male' },
  { id: 'ballad', label: 'Ballad (male)', gender: 'male' },
  { id: 'coral', label: 'Coral (female)', gender: 'female' },
  { id: 'sage', label: 'Sage (neutral)', gender: 'neutral' },
  { id: 'verse', label: 'Verse (female)', gender: 'female' }
]

type AppShellProps = {
  user: User
  onLogout: () => void
  children: ReactNode
  hideHeader?: boolean
}

export default function AppShell({ user, onLogout, children, hideHeader = false }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const voiceGenderKey = `tts_voice_gender_${user.email}`
  const voiceAgeKey = `tts_voice_age_${user.email}`
  const voiceIdKey = `tts_voice_id_${user.email}`

  const [voiceGender, setVoiceGender] = useState<'auto' | 'male' | 'female'>(() => {
    if (typeof window === 'undefined') return 'auto'
    try {
      const stored = window.localStorage.getItem(voiceGenderKey) as
        | 'auto'
        | 'male'
        | 'female'
        | null
      return stored || 'auto'
    } catch {
      return 'auto'
    }
  })

  const [voiceAge, setVoiceAge] = useState<'auto' | 'young' | 'mature'>(() => {
    if (typeof window === 'undefined') return 'auto'
    try {
      const stored = window.localStorage.getItem(voiceAgeKey) as
        | 'auto'
        | 'young'
        | 'mature'
        | null
      return stored || 'auto'
    } catch {
      return 'auto'
    }
  })
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | ''>(() => {
    if (typeof window === 'undefined') return ''
    try {
      return window.localStorage.getItem(voiceIdKey) || ''
    } catch {
      return ''
    }
  })

  const [voiceSearch, setVoiceSearch] = useState('')

  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewAudioUrlRef = useRef<string | null>(null)

  async function previewVoice(voice: ServerVoice, id: string) {
    if (isPreviewing && previewingVoiceId === id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.currentTime = 0
      }
      setIsPreviewing(false)
      setPreviewingVoiceId(null)
      return
    }

    try {
      setIsPreviewing(true)
      setPreviewingVoiceId(id)

      const response = await fetch(`${API_BASE_URL}/api/voice/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'This is a preview of this voice.',
          language: 'en',
          voice: voice.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to synthesize preview audio')
      }

      const blob = await response.blob()

      if (previewAudioUrlRef.current) {
        URL.revokeObjectURL(previewAudioUrlRef.current)
        previewAudioUrlRef.current = null
      }

      const url = URL.createObjectURL(blob)
      previewAudioUrlRef.current = url

      const audio = new Audio(url)
      previewAudioRef.current = audio

      audio.onended = () => {
        setIsPreviewing(false)
        setPreviewingVoiceId(null)
      }

      await audio.play()
    } catch {
      setIsPreviewing(false)
      setPreviewingVoiceId(null)
    }
  }

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
      if (previewAudioUrlRef.current) {
        URL.revokeObjectURL(previewAudioUrlRef.current)
        previewAudioUrlRef.current = null
      }
    }
  }, [])

  return (
    <VoiceSettingsContext.Provider value={{ openVoiceSettings: () => setDrawerOpen(true) }}>
      <div className="app-shell">
      {!hideHeader && (
        <header className="header">
          <div className="logo-wrap">
            <img src="/logo.svg" alt="reAct Agent" className="brand-logo" />
            <div>
              <div className="logo-title">reAct Agent</div>
              <div className="logo-subtitle">AI Assistant</div>
            </div>
          </div>

          <button className="user-chip" onClick={() => setDrawerOpen(true)}>
            <span>{user.name}</span>
            <span className="avatar">{getInitials(user.name)}</span>
          </button>
        </header>
      )}

      {hideHeader && (
        <button className="floating-user-btn" onClick={() => setDrawerOpen(true)}>
          <span className="avatar">{getInitials(user.name)}</span>
        </button>
      )}

      <aside className={`drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3>Menu</h3>
          <button className="ghost-btn" onClick={() => setDrawerOpen(false)}>Close</button>
        </div>
        <nav className="drawer-links" onClick={() => setDrawerOpen(false)}>
          <Link to="/">Chat Screen</Link>
          <Link to="/profile">User Profile</Link>
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
        <div className="drawer-section">
          <h4>Voice settings</h4>
          <div className="drawer-field">
            <div className="drawer-field-label">Voice type</div>
            <div className="drawer-pill-group">
              <button
                type="button"
                className={`lang-pill ${voiceGender === 'auto' ? 'active' : ''}`}
                onClick={() => {
                  setVoiceGender('auto')
                  try {
                    window.localStorage.setItem(voiceGenderKey, 'auto')
                  } catch {
                    // ignore
                  }
                }}
              >
                Auto
              </button>
              <button
                type="button"
                className={`lang-pill ${voiceGender === 'female' ? 'active' : ''}`}
                onClick={() => {
                  setVoiceGender('female')
                  try {
                    window.localStorage.setItem(voiceGenderKey, 'female')
                  } catch {
                    // ignore
                  }
                }}
              >
                Female
              </button>
              <button
                type="button"
                className={`lang-pill ${voiceGender === 'male' ? 'active' : ''}`}
                onClick={() => {
                  setVoiceGender('male')
                  try {
                    window.localStorage.setItem(voiceGenderKey, 'male')
                  } catch {
                    // ignore
                  }
                }}
              >
                Male
              </button>
            </div>
          </div>
          <div className="drawer-field">
            <div className="drawer-field-label">Age tone</div>
            <div className="drawer-pill-group">
              <button
                type="button"
                className={`lang-pill ${voiceAge === 'auto' ? 'active' : ''}`}
                onClick={() => {
                  setVoiceAge('auto')
                  try {
                    window.localStorage.setItem(voiceAgeKey, 'auto')
                  } catch {
                    // ignore
                  }
                }}
              >
                Auto
              </button>
              <button
                type="button"
                className={`lang-pill ${voiceAge === 'young' ? 'active' : ''}`}
                onClick={() => {
                  setVoiceAge('young')
                  try {
                    window.localStorage.setItem(voiceAgeKey, 'young')
                  } catch {
                    // ignore
                  }
                }}
              >
                Young
              </button>
              <button
                type="button"
                className={`lang-pill ${voiceAge === 'mature' ? 'active' : ''}`}
                onClick={() => {
                  setVoiceAge('mature')
                  try {
                    window.localStorage.setItem(voiceAgeKey, 'mature')
                  } catch {
                    // ignore
                  }
                }}
              >
                Mature
              </button>
            </div>
          </div>
          <div className="drawer-field">
            <div className="drawer-field-label">Search voices</div>
            <input
              className="voice-search"
              placeholder="Search by name or id..."
              value={voiceSearch}
              onChange={(event) => setVoiceSearch(event.target.value)}
            />
          </div>
          <div className="drawer-field">
            <div className="drawer-field-label">Available voices</div>
            <div className="voice-grid">
              <button
                type="button"
                className={`voice-card ${!selectedVoiceId ? 'active' : ''}`}
                onClick={() => {
                  setSelectedVoiceId('')
                  try {
                    window.localStorage.removeItem(voiceIdKey)
                  } catch {
                    // ignore
                  }
                }}
              >
                <div className="voice-card-title">Auto voice</div>
                <div className="voice-card-meta">
                  <span className="voice-chip">Smart pick</span>
                </div>
              </button>
              {SERVER_VOICES
                .filter((voice) => {
                  const text = `${voice.label} ${voice.id}`.toLowerCase()
                  const query = voiceSearch.trim().toLowerCase()
                  if (query && !text.includes(query)) return false

                  if (voiceGender === 'female' && voice.gender !== 'female') return false
                  if (voiceGender === 'male' && voice.gender !== 'male') return false
                  return true
                })
                .map((voice) => {
                  const id = voice.id
                  const genderLabel =
                    voice.gender === 'male' ? 'Male' : voice.gender === 'female' ? 'Female' : 'Neutral'
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`voice-card ${selectedVoiceId === id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedVoiceId(id)
                        try {
                          window.localStorage.setItem(voiceIdKey, id)
                        } catch {
                          // ignore
                        }
                      }}
                    >
                      <div className="voice-card-title">{voice.label}</div>
                      <div className="voice-card-meta">
                        <span className="voice-chip">{genderLabel}</span>
                        <span
                          className="voice-chip voice-chip-preview"
                          onClick={(event) => {
                            event.stopPropagation()
                            previewVoice(voice, id)
                          }}
                        >
                          {isPreviewing && previewingVoiceId === id ? '◼ Stop' : '▶ Preview'}
                        </span>
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
        <button className="danger-btn" onClick={onLogout}>Logout</button>
      </aside>

      {drawerOpen && <div className="backdrop" onClick={() => setDrawerOpen(false)} />}

      <main className="content">{children}</main>

      <footer className="footer">
        <Link to="/privacy-policy">Privacy Policy</Link>
        <span>•</span>
        <Link to="/terms">Terms & Conditions</Link>
      </footer>
      </div>
    </VoiceSettingsContext.Provider>
  )
}
