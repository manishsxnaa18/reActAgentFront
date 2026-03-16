import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import AuthPage from './pages/AuthPage'
import ChatPage from './pages/ChatPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsPage from './pages/TermsPage'
import ProfilePage from './pages/ProfilePage'
import type { User } from './types'
import { clearUser, getStoredUser, saveUser } from './utils/userSession'

function App() {
  const [user, setUser] = useState<User | null>(() => getStoredUser())

  function handleLogin(nextUser: User) {
    saveUser(nextUser)
    setUser(nextUser)
  }

  function handleLogout() {
    clearUser()
    setUser(null)
  }

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage onLogin={handleLogin} />} />

      <Route
        path="/"
        element={
          <ProtectedRoute user={user}>
            <AppShell user={user!} onLogout={handleLogout} hideHeader>
              <ChatPage user={user!} />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/privacy-policy"
        element={
          <ProtectedRoute user={user}>
            <AppShell user={user!} onLogout={handleLogout}>
              <PrivacyPolicyPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/terms"
        element={
          <ProtectedRoute user={user}>
            <AppShell user={user!} onLogout={handleLogout}>
              <TermsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute user={user}>
            <AppShell user={user!} onLogout={handleLogout}>
              <ProfilePage user={user!} />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to={user ? '/' : '/auth'} replace />} />
    </Routes>
  )
}

export default App
