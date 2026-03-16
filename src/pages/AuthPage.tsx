import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '../types'

type AuthPageProps = {
  onLogin: (user: User) => void
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile')
  const [countryCode, setCountryCode] = useState('+91')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [generatedOtp, setGeneratedOtp] = useState('')

  const countryOptions = ['+91', '+1', '+44', '+61', '+65', '+971']

  function sendOtp() {
    if (!phone.trim()) return
    const devOtp = '123456'
    setGeneratedOtp(devOtp)
    setOtp(devOtp)
    setStep('otp')
  }

  function completeAuth(event: FormEvent) {
    event.preventDefault()
    if (!otp.trim()) return

    const normalizedPhone = phone.replace(/\D/g, '')
    const fullPhone = `${countryCode}${normalizedPhone}`
    const finalName = `User ${fullPhone}`
    const finalEmail = `${normalizedPhone || 'user'}@demo.app`
    const user = { name: finalName, email: finalEmail }
    onLogin(user)
    navigate('/')
  }

  function socialLogin(provider: string) {
    const user = { name: `${provider} User`, email: `${provider.toLowerCase()}@demo.app` }
    onLogin(user)
    navigate('/')
  }

  return (
    <section className="auth-wrap">
      <div className="auth-card">
        <h1>Login</h1>
        <p className="muted">Use mobile number login. OTP is auto-filled in dev mode.</p>

        {step === 'mobile' ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              sendOtp()
            }}
            className="auth-form"
          >
            <div className="mobile-row">
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                {countryOptions.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
              <input
                placeholder="Mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <button type="submit">Send OTP</button>
          </form>
        ) : (
          <form onSubmit={completeAuth} className="auth-form">
            <p className="muted">OTP sent to {countryCode} {phone}</p>
            <input
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <p className="muted">Dev mode OTP auto-filled: {generatedOtp}</p>
            <button type="submit">Verify OTP</button>
            <button type="button" className="tab" onClick={() => setStep('mobile')}>Change Number</button>
          </form>
        )}

        <div className="divider">or continue with</div>
        <div className="social-grid">
          <button onClick={() => socialLogin('Google')}>Google</button>
          <button onClick={() => socialLogin('GitHub')}>GitHub</button>
          <button onClick={() => socialLogin('Microsoft')}>Microsoft</button>
        </div>
      </div>
    </section>
  )
}
