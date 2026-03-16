# reActAgent Frontend

Frontend app for reAct Agent built with React + TypeScript + Vite.

## Pages Implemented

1. Main Screen (chat)
2. Privacy Policy
3. Terms & Conditions
4. User Profile (via header drawer)
5. Login / Signup (dummy OTP flow)
6. Social login buttons (Google, GitHub, Microsoft - dummy)

## UI Layout

- Header: logo on left, username + circular avatar on right
- Right drawer on avatar click with navigation links
- Chat as the main screen
- Footer with Privacy Policy and Terms links

## Run Locally

```bash
npm install
cp .env.example .env
npm run dev
```

Default frontend URL: `http://127.0.0.1:5173`

## API Configuration

Set backend URL in `.env`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:3001
```

Ensure your Fastify backend (`reActAgent`) is running before using chat.

## Build

```bash
npm run build
```
