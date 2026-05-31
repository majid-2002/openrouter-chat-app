# OpenRouter Chat App

A local-first AI chat application built with Next.js, Prisma, SQLite, and OpenRouter. It provides a dark ChatGPT-style interface with model selection, streaming responses, chat history, image attachments, reasoning mode, optional web search, and code-copy support.

## Features

- Server-side OpenRouter API integration
- Streaming chat responses
- OpenRouter model picker
- Persistent chats with SQLite
- Chat create, switch, rename, and delete
- Image attachment support for vision-capable models
- Optional Think mode for reasoning-capable models
- Optional OpenRouter web search per message
- OpenRouter credit balance display
- Markdown rendering with styled code blocks
- Copy full messages or individual code blocks
- Dark responsive UI with collapsible chat sidebar

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Prisma
- SQLite
- OpenAI SDK configured for OpenRouter

## Platform Compatibility

The app supports both desktop Node.js and Android/Termux:

- Windows, Linux, and macOS use Prisma Client by default.
- Android/Termux uses the built-in `node:sqlite` adapter because Prisma's native query engine is not available there.
- Set `DATABASE_CLIENT="prisma"` to force Prisma Client, or `DATABASE_CLIENT="sqlite"` to force the fallback adapter.

Use Node.js `20.9+` on desktop. Use Node.js `24+` on Android/Termux so `node:sqlite` is available.

## Getting Started

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenRouter key:

```env
DATABASE_URL="file:./dev.db"
DATABASE_CLIENT="auto"
OPENROUTER_API_KEY="your-openrouter-key"
OPENROUTER_SITE_URL="http://localhost:3000"
OPENROUTER_APP_NAME="AI Chat OpenRouter"
```

Run the database migration on Windows, Linux, or macOS:

```bash
npx prisma migrate dev
```

On Android/Termux, the fallback SQLite adapter creates the needed local tables automatically when the app starts.

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev        # Start local development server
npm run build      # Build production bundle
npm run start      # Start production server
npm run lint       # Run ESLint
npm run db:generate
npm run db:migrate
```

## Environment And Secrets

Do not commit `.env` or real API keys. This repository intentionally ignores `.env*` except `.env.example`.

The OpenRouter key is only used on the server through Next.js API routes. It is not exposed to the browser.

## Notes

- Image chat requires a vision-capable OpenRouter model.
- Think mode requires a reasoning-capable OpenRouter model. Unsupported models may ignore it or return an upstream error.
- Web search uses OpenRouter's server-side search tool and may add provider cost when enabled.
- SQLite is local to this project. The generated database file is ignored by Git.
