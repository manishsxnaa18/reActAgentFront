import type { User } from '../types'
import { getInitials } from '../utils/user'

type ProfilePageProps = {
  user: User
}

export default function ProfilePage({ user }: ProfilePageProps) {
  return (
    <section className="card-page">
      <h1>User Profile</h1>
      <div className="profile-row">
        <div className="avatar large">{getInitials(user.name)}</div>
        <div>
          <h3>{user.name}</h3>
          <p className="muted">{user.email}</p>
        </div>
      </div>
      <div className="profile-grid">
        <div>
          <h4>Role</h4>
          <p>Business User (Demo)</p>
        </div>
        <div>
          <h4>Workspace</h4>
          <p>reAct Agent Frontend</p>
        </div>
        <div>
          <h4>Auth Mode</h4>
          <p>Dummy OTP / Social Mock</p>
        </div>
        <div>
          <h4>Preferences</h4>
          <p>Chat-first layout, drawer navigation</p>
        </div>
      </div>
      <p className="muted">Profile settings are demo-only and can be connected to real user management later.</p>
    </section>
  )
}
