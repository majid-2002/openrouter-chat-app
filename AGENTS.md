# Agent Notes

## Project Overview

This is a Next.js App Router application for chatting with OpenRouter models. The UI lives primarily in `src/components/chat-app.tsx`; server API routes live under `src/app/api`.

## Development Rules

- Never commit `.env`, real API keys, SQLite database files, or generated build output.
- Use `.env.example` for placeholder environment documentation only.
- Keep OpenRouter calls server-side. Do not expose `OPENROUTER_API_KEY` to client components.
- Run `npm run lint` and `npm run build` before pushing.
- If the Prisma schema changes, run `npx prisma migrate dev --name <name>` and commit the migration.

## Important Files

- `src/components/chat-app.tsx`: Main chat UI, sidebar, composer, model picker, image preview, copy buttons.
- `src/app/api/chats/[id]/messages/route.ts`: Streaming OpenRouter chat endpoint.
- `src/app/api/models/route.ts`: OpenRouter model list endpoint.
- `prisma/schema.prisma`: Chat, message, attachment, and settings schema.
- `src/lib/openrouter.ts`: OpenRouter client setup.

## Validation

Before handoff or push:

```bash
npm run lint
npm run build
```
