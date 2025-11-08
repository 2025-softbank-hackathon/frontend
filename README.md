# Global Chat Frontend

React 18 single-room chat UI that connects to a Spring Boot STOMP WebSocket backend. Users join with a nickname (no authentication) and exchange text-only messages in real time.

## Quick Start

```bash
npm install
npm start
```

Open http://localhost:3002 after the dev server starts.

> ℹ️ Network access is required for the dependency installation step. If the command fails due to offline mode, retry once you have connectivity.

## Environment Variables

Create a `.env.local` file to configure the backend endpoints:

```dotenv
REACT_APP_API_BASE=http://localhost:3000
REACT_APP_WS_URL=http://localhost:3000/ws-stomp
REACT_APP_STOMP_SUB=/topic/chatroom/global
REACT_APP_STOMP_PUB=/app/chatroom.send
```

Restart the dev server after changing any env values.

## Available Scripts

- `npm start` – start the development server with fast refresh.
- `npm run build` – create a production build in `build/`.
- `npm test` – run Jest tests (none are included by default).

## Features

- Automatic nickname issuance via `/api/join`; no client nickname prompt.
- Initial bootstrap fetch of the latest 100 messages from `/api/messages`.
- STOMP over SockJS connection with exponential backoff reconnects and error toasts.
- Connection badge + notice banner reflecting `connecting`, `connected`, `reconnecting` and `disconnected` states (rate limit badge support).
- Optimistic rendering for outgoing messages with reconciliation once the server echoes them.
- Accessible input area: multiline textarea (Shift+Enter newline, Enter send), 500 character counter, focusable controls.
- Responsive layout tuned for desktop and ≤480px wide screens.

## Keyboard Shortcuts

- `Enter` – send message
- `Shift + Enter` – add newline in the composer
- `Tab` – move focus between interactive elements inside the chat composer area

## Limitations & Notes

- Only text messages are rendered; other payload types are ignored client-side.
- Message size is clamped to 500 characters before sending.
- Optimistic messages mark errors when publishing fails; retry manually.
- Ensure the backend echoes a unique `id` or `clientId` per message for best deduplication.
