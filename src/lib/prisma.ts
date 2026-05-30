import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

type SqliteStatement = {
  all: (...values: unknown[]) => unknown[];
  get: (...values: unknown[]) => unknown;
  run: (...values: unknown[]) => unknown;
};

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
};

const loadNodeModule = createRequire(import.meta.url);
const { DatabaseSync } = loadNodeModule("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

type Chat = {
  id: string;
  title: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
};

type Message = {
  id: string;
  chatId: string;
  role: string;
  content: string;
  createdAt: Date;
};

type MessageAttachment = {
  id: string;
  messageId: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  createdAt: Date;
};

type MessageWithAttachments = Message & {
  attachments: MessageAttachment[];
};

type ChatWithMessages = Chat & {
  messages: MessageWithAttachments[];
};

type ChatFindUniqueArgs = {
  where: { id: string };
  include?: {
    messages?: {
      orderBy?: { createdAt: "asc" | "desc" };
      include?: {
        attachments?: { orderBy?: { createdAt: "asc" | "desc" } };
      };
    };
  };
};

type MessageCreateArgs = {
  data: {
    chatId: string;
    role: string;
    content: string;
    attachments?: {
      create: Array<{ name: string; mimeType: string; dataUrl: string }>;
    };
  };
};

const globalForSqlite = globalThis as unknown as {
  appDb?: SqliteDatabase;
};

function getDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const filePrefix = "file:";
  const rawPath = databaseUrl.startsWith(filePrefix)
    ? databaseUrl.slice(filePrefix.length)
    : databaseUrl;

  return rawPath.startsWith("/")
    ? rawPath
    : join(process.cwd(), rawPath === "./dev.db" ? "prisma/dev.db" : rawPath);
}

function getDatabase() {
  if (globalForSqlite.appDb) {
    return globalForSqlite.appDb;
  }

  const dbPath = getDatabasePath();
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  ensureSchema(db);
  globalForSqlite.appDb = db;

  return db;
}

function ensureSchema(db: SqliteDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "Chat" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "model" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "Message" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "chatId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Message_chatId_fkey"
        FOREIGN KEY ("chatId") REFERENCES "Chat" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "MessageAttachment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "messageId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "dataUrl" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MessageAttachment_messageId_fkey"
        FOREIGN KEY ("messageId") REFERENCES "Message" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "Message_chatId_createdAt_idx"
      ON "Message"("chatId", "createdAt");

    CREATE INDEX IF NOT EXISTS "MessageAttachment_messageId_idx"
      ON "MessageAttachment"("messageId");
  `);
}

function toDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "number") {
    return new Date(value);
  }

  const text = String(value);
  return new Date(text.includes("T") ? text : `${text.replace(" ", "T")}Z`);
}

function rowToChat(row: Record<string, unknown>): Chat {
  return {
    id: String(row.id),
    title: String(row.title),
    model: String(row.model),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    chatId: String(row.chatId),
    role: String(row.role),
    content: String(row.content),
    createdAt: toDate(row.createdAt),
  };
}

function rowToAttachment(row: Record<string, unknown>): MessageAttachment {
  return {
    id: String(row.id),
    messageId: String(row.messageId),
    name: String(row.name),
    mimeType: String(row.mimeType),
    dataUrl: String(row.dataUrl),
    createdAt: toDate(row.createdAt),
  };
}

function getMessages(chatId: string, order: "asc" | "desc" = "asc") {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM "Message"
       WHERE "chatId" = ?
       ORDER BY "createdAt" ${order === "desc" ? "DESC" : "ASC"}`,
    )
    .all(chatId) as Array<Record<string, unknown>>;
  const messages = rows.map(rowToMessage);

  return messages.map((message) => ({
    ...message,
    attachments: getAttachments(message.id),
  }));
}

function getAttachments(messageId: string, order: "asc" | "desc" = "asc") {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM "MessageAttachment"
       WHERE "messageId" = ?
       ORDER BY "createdAt" ${order === "desc" ? "DESC" : "ASC"}`,
    )
    .all(messageId) as Array<Record<string, unknown>>;

  return rows.map(rowToAttachment);
}

export const prisma: {
  chat: {
    findMany: (args?: unknown) => Promise<Chat[]>;
    create: (args: { data: { title: string; model: string } }) => Promise<Chat>;
    findUnique: (args: ChatFindUniqueArgs) => Promise<ChatWithMessages | null>;
    update: (args: {
      where: { id: string };
      data: { title?: string; model?: string };
    }) => Promise<Chat>;
    delete: (args: { where: { id: string } }) => Promise<null>;
  };
  message: {
    create: (args: MessageCreateArgs) => Promise<MessageWithAttachments>;
  };
} = {
  chat: {
    async findMany() {
      const db = getDatabase();
      const rows = db
        .prepare(`SELECT * FROM "Chat" ORDER BY "updatedAt" DESC`)
        .all() as Array<Record<string, unknown>>;

      return rows.map(rowToChat);
    },

    async create({ data }: { data: { title: string; model: string } }) {
      const db = getDatabase();
      const now = new Date().toISOString();
      const chat = {
        id: randomUUID(),
        title: data.title,
        model: data.model,
        createdAt: now,
        updatedAt: now,
      };

      db.prepare(
        `INSERT INTO "Chat" ("id", "title", "model", "createdAt", "updatedAt")
         VALUES (?, ?, ?, ?, ?)`,
      ).run(chat.id, chat.title, chat.model, chat.createdAt, chat.updatedAt);

      return rowToChat(chat);
    },

    async findUnique(args: ChatFindUniqueArgs) {
      const db = getDatabase();
      const row = db
        .prepare(`SELECT * FROM "Chat" WHERE "id" = ?`)
        .get(args.where.id) as Record<string, unknown> | undefined;

      if (!row) {
        return null;
      }

      const chat = rowToChat(row);
      const order = args.include?.messages?.orderBy?.createdAt ?? "asc";
      return {
        ...chat,
        messages: args.include?.messages ? getMessages(chat.id, order) : [],
      } satisfies ChatWithMessages;
    },

    async update({
      where,
      data,
    }: {
      where: { id: string };
      data: { title?: string; model?: string };
    }) {
      const db = getDatabase();
      const existing = (await this.findUnique({ where })) as Chat | null;
      if (!existing) {
        throw new Error("Chat not found.");
      }

      const updated = {
        ...existing,
        title: data.title ?? existing.title,
        model: data.model ?? existing.model,
        updatedAt: new Date(),
      };

      db.prepare(
        `UPDATE "Chat"
         SET "title" = ?, "model" = ?, "updatedAt" = ?
         WHERE "id" = ?`,
      ).run(
        updated.title,
        updated.model,
        updated.updatedAt.toISOString(),
        updated.id,
      );

      return updated;
    },

    async delete({ where }: { where: { id: string } }) {
      const db = getDatabase();
      db.prepare(`DELETE FROM "Chat" WHERE "id" = ?`).run(where.id);
      return null;
    },
  },

  message: {
    async create({ data }: MessageCreateArgs) {
      const db = getDatabase();
      const now = new Date().toISOString();
      const message = {
        id: randomUUID(),
        chatId: data.chatId,
        role: data.role,
        content: data.content,
        createdAt: now,
      };

      db.exec("BEGIN");
      try {
        db.prepare(
          `INSERT INTO "Message"
           ("id", "chatId", "role", "content", "createdAt")
           VALUES (?, ?, ?, ?, ?)`,
        ).run(
          message.id,
          message.chatId,
          message.role,
          message.content,
          message.createdAt,
        );

        for (const attachment of data.attachments?.create ?? []) {
          db.prepare(
            `INSERT INTO "MessageAttachment"
             ("id", "messageId", "name", "mimeType", "dataUrl", "createdAt")
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(
            randomUUID(),
            message.id,
            attachment.name,
            attachment.mimeType,
            attachment.dataUrl,
            now,
          );
        }

        db.prepare(`UPDATE "Chat" SET "updatedAt" = ? WHERE "id" = ?`).run(
          now,
          message.chatId,
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }

      return {
        ...rowToMessage(message),
        attachments: getAttachments(message.id),
      } satisfies MessageWithAttachments;
    },
  },
};
