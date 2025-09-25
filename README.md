## Weather Chat App

Lightweight React + Vite + TypeScript app that provides a chat-style interface for weather questions. The UI streams responses from a hosted weather agent and renders them in a structured, readable format.

### Features
- **Chat UI**: Clean, single-input chat with streaming assistant replies
- **Weather-only guardrails**: Client prompts the agent to keep answers weather-focused
- **Streaming**: Server-Sent Events (SSE) streaming with incremental rendering
- **Local persistence**: Messages cached in `localStorage` for session continuity
- **Input validation**: Gentle nudge to include a location before sending
- **Clear & retry controls**: Cancel current request, clear thread, retry on error
- **Tailwind styling**: Modern, accessible layout with focus states and keyboard support

### Tech Stack
- **Framework**: React 18, TypeScript
- **Build tool**: Vite 5
- **Styling**: Tailwind CSS 3

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Install
```bash
npm install
```

### Develop
```bash
npm run dev
```
Open the printed local URL in your browser.

### Build
```bash
npm run build
```
The production build is emitted to `dist/`.

### Preview production build
```bash
npm run preview
```

## How It Works

- The app mounts `App` → `ChatUI` and uses a custom hook `useWeatherStream` to send user text to a hosted weather agent.
- Requests are posted to an SSE endpoint and streamed back. Chunks are parsed and appended live to the assistant message.
- The UI lightly formats the agent response for readability (sections, bullets, inline bold).

Key files:
- `src/components/chat/ChatUI.tsx` — UI, input handling, rendering
- `src/hooks/useWeatherStream.ts` — network flow, cancellation, error mapping
- `src/lib/api.ts` — request payload, SSE parsing/utilities
- `src/App.tsx`, `src/main.tsx` — app bootstrap
- `tailwind.config.js`, `src/index.css` — styling setup

## Configuration

By default, the client posts to a hosted demo endpoint and uses a fixed thread identifier:
- Endpoint: defined as `API_ENDPOINT` in `src/lib/api.ts`
- Thread ID: defined as `THREAD_ID` in `src/lib/api.ts`

If you need to point to a different backend, you can either edit those constants or inject values at build-time using Vite environment variables and small code changes. Suggested keys:
- `VITE_WEATHER_API_ENDPOINT`
- `VITE_WEATHER_THREAD_ID`

Example (after wiring these in `src/lib/api.ts`):
```bash
VITE_WEATHER_API_ENDPOINT=https://your-host/api/agents/weatherAgent/stream \
VITE_WEATHER_THREAD_ID=your-thread-id \
npm run dev
```

Note: This project, as provided, does not require private API keys. If your backend later requires credentials, prefer environment variables and never commit secrets.

## Usage

1. Type a weather question including a location (e.g., "Weather in London?" or "Mumbai tomorrow").
2. Press Enter or click Send. The spinner indicates streaming in progress.
3. Use the trash icon to clear the conversation. Use the retry link in the error banner to resend.

## Accessibility & UX
- Keyboard: Enter to send, Shift+Enter for newline is prevented in favor of quick send
- Focus states and roles on inputs/buttons
- Readable color contrast with Tailwind utility classes

## Deployment

This is a static front-end and can be deployed on any static host.

### Netlify
1. Build locally or via CI: `npm run build`
2. Publish directory: `dist`

### Vercel
1. Import the repo
2. Framework preset: Vite
3. Build command: `npm run build`
4. Output directory: `dist`

### GitHub Pages / Static servers
1. `npm run build`
2. Serve `dist/` via any static server/CDN

If you parameterize the endpoint via env vars, configure those in your host (e.g., Vercel Project Settings → Environment Variables) and redeploy.

## API Specification

### Endpoint
POST `https://brief-thousanas-sunset-9fcbIc78-485f-4967-ac04-2759a8fa1462.mastra.cloud/api/agents/weatherAgent/stream`

### Headers
```http
Accept: text/event-stream
Accept-Language: en-GB,en-US;q=0.99,en;q=0.88,fr;q=0.77
Connection: keep-alive
Content-Type: application/json
x-mastra-dev-playground: true
```

### Request Body (JSON)
```json
{
  "messages": [
    { "role": "user", "content": "Your message here" }
  ],
  "runId": "weatherAgent",
  "maxRetries": 2,
  "maxSteps": 5,
  "temperature": 0.5,
  "topP": 1,
  "runtimeContext": {},
  "threadId": "<YOUR_COLLEGE_ROLL_NUMBER>",
  "resourceId": "weatherAgent"
}
```

Note: Set `threadId` to your college roll number as required by the task.

### Example cURL
```bash
curl -X POST \
  'https://brief-thousanas-sunset-9fcbIc78-485f-4967-ac04-2759a8fa1462.mastra.cloud/api/agents/weatherAgent/stream' \
  -H 'Accept: text/event-stream' \
  -H 'Accept-Language: en-GB,en-US;q=0.99,en;q=0.88,fr;q=0.77' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'x-mastra-dev-playground: true' \
  --data '{
    "messages": [ { "role": "user", "content": "Weather in London?" } ],
    "runId": "weatherAgent",
    "maxRetries": 2,
    "maxSteps": 5,
    "temperature": 0.5,
    "topP": 1,
    "runtimeContext": {},
    "threadId": "<YOUR_COLLEGE_ROLL_NUMBER>",
    "resourceId": "weatherAgent"
  }'
```

## Limitations
- The demo endpoint enforces weather-only responses; non-weather prompts will be redirected by the assistant
- Network interruptions will surface as friendly errors; retry to resume

## Scripts
- `npm run dev` — start dev server
- `npm run build` — type-check then build for production
- `npm run preview` — preview built output

## License

Generic placeholder: choose a license that suits your distribution requirements (e.g., MIT). If unspecified, treat as all-rights-reserved for evaluation purposes.


