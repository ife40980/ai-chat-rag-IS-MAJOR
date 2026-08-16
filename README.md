# My AI Chat

A full-stack chat app that talks to an AI model through a secure backend.
Frontend: React + TypeScript (Vite). Backend: Node.js + Express, calling the Google Gemini API (free tier).

## Project structure

```
ai-chat-project/
  backend/     -> Express server that securely calls the AI API
  frontend/    -> React + TypeScript chat UI
```

## 1. Get a free API key

Go to https://aistudio.google.com/apikey, sign in with a Google account, and click
"Create API key." No credit card required. This gives you free-tier access to
Gemini's Flash-class models, which is what this project uses (`gemini-2.5-flash`).

Note: free-tier usage may be reviewed by Google to improve their products, per their
terms — fine for a personal/learning project, but worth knowing.

(You can swap in a different provider's API later if you want — the backend is the only
place that would need to change. See the note at the bottom of this file on switching
to the Anthropic/Claude API.)

## 2. Set up the backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and paste your real API key in place of `your_api_key_here`.

Start the backend:

```bash
npm start
```

You should see:
```
AI chat backend running at http://localhost:3001
```

## 3. Set up the frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite will print a local URL, usually `http://localhost:5173`. Open that in your browser.

## 4. Try it out

Type a message and hit Send (or press Enter). The frontend sends your whole
conversation to the backend, the backend forwards it to the Anthropic API,
and the reply streams back into the chat window.

## How it works (for your resume / explaining in an interview)

- The **frontend never talks to the AI API directly** — it only talks to your own backend.
  This keeps your API key private (never exposed to the browser).
- The backend receives the full message history each time, since the AI API itself
  has no memory between requests — your server is responsible for passing context along.
- `ChatWindow.tsx` keeps the conversation in React state and re-renders the message list
  as new messages come in.

## Ideas to extend this project (good for leveling it up)

- **Streaming responses:** show the reply appearing word-by-word instead of all at once.
- **Persistent history:** save conversations in a database (e.g., Postgres) so users can revisit past chats.
- **Login/auth:** give each user their own saved conversations.
- **Deploy it:** host the backend (e.g., Render, Railway) and frontend (e.g., Vercel, Netlify)
  so you have a live link to put on your resume.

## Switching to Claude (Anthropic) later

The whole app is built provider-agnostically on purpose — the frontend only ever
talks to your own backend, never to Gemini or Claude directly. So switching providers
later only means editing `backend/server.js`, nothing in `frontend/`. To swap to Claude:

1. Get a key from https://console.anthropic.com/ and put it in `.env` as `ANTHROPIC_API_KEY`.
2. In `server.js`, change the endpoint to `https://api.anthropic.com/v1/messages`,
   add the `x-api-key` and `anthropic-version: 2023-06-01` headers, and change the request
   body to `{ model, max_tokens, messages }` (Claude uses `role: "user" | "assistant"`
   directly, so you'd actually remove the Gemini role-mapping step, not add one).
3. Claude's response comes back as `data.content`, an array of blocks — pull out the
   `type: "text"` blocks and join them, instead of Gemini's `candidates[0].content.parts`.

Everything else — the React chat UI, the message state, the styling — stays exactly the same.
