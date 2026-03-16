export default function PrivacyPolicyPage() {
  return (
    <section className="card-page">
      <h1>Privacy Policy</h1>
      <p>This policy explains how we process user data in the reAct Agent web application.</p>
      <ul>
        <li>We collect basic profile data (name, email, and demo login state) for session experience.</li>
        <li>Chat requests are sent to the configured API endpoint for assistant responses and tool execution.</li>
        <li>Calendar, Jira, and search requests use the credentials configured on the backend environment.</li>
        <li>We do not recommend sharing highly sensitive personal, legal, or financial data in chat.</li>
        <li>For policy concerns, contact your internal admin or the support owner listed by your org.</li>
      </ul>
      <p className="muted">Policy reference: hybrid work, vacation, reimbursement, conduct, and workplace safety are managed by your company policy handbook.</p>
    </section>
  )
}
