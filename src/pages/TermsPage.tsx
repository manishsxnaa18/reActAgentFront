export default function TermsPage() {
  return (
    <section className="card-page">
      <h1>Terms & Conditions</h1>
      <p>By using reAct Agent, you agree to the following terms for this release:</p>
      <ul>
        <li>This environment currently uses demo login and does not verify real OTP identity.</li>
        <li>Social login buttons are placeholders and are not connected to OAuth providers yet.</li>
        <li>AI responses may be imperfect; verify business-critical output before execution.</li>
        <li>Actions against integrated systems (Calendar/Jira) are your responsibility.</li>
        <li>Service availability depends on third-party APIs and configured environment variables.</li>
      </ul>
      <p className="muted">Commercial or legal commitments should be validated through your standard internal approval process.</p>
    </section>
  )
}
