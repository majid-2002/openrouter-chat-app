"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Check,
  ChevronDown,
  Clipboard,
  ClipboardCheck,
  Globe2,
  Image as ImageIcon,
  Loader2,
  MessageSquarePlus,
  PanelLeft,
  Paperclip,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  SquareStop,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import type {
  ChatDetail,
  ChatAttachment,
  ChatMessage,
  ChatSummary,
  OpenRouterCredits,
  OpenRouterModel,
} from "@/lib/types";
import { DEFAULT_MODEL } from "@/lib/openrouter";

type ApiError = {
  error?: string;
};

type CodeComponentProps = {
  children?: React.ReactNode;
  className?: string;
};

const promptSets = [
  [
    "Write a to-do list for a personal project or task",
    "Generate an email to reply to a job offer",
    "Summarise this article or text for me in one paragraph",
    "How does AI work in a technical capacity",
  ],
  [
    "Review this code and point out bugs or edge cases",
    "Draft a concise project update for my team",
    "Turn these notes into a clear action plan",
    "Explain this concept like I am new to the topic",
  ],
  [
    "Compare two technical approaches and recommend one",
    "Create test cases for this feature",
    "Rewrite this message to sound more professional",
    "Help me debug this error step by step",
  ],
];

const allowedImageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const maxImageSize = 5 * 1024 * 1024;
const maxMessageLength = 10000;
const creditFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
});

export function ChatApp() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [credits, setCredits] = useState<OpenRouterCredits | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<ChatAttachment[]>([]);
  const [thinkEnabled, setThinkEnabled] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [promptSetIndex, setPromptSetIndex] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<ChatSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const sendAbortControllerRef = useRef<AbortController | null>(null);
  const localIdRef = useRef(0);
  const didBootstrapRef = useRef(false);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [activeChatId, chats],
  );

  const promptCards = promptSets[promptSetIndex];

  const modelOptions = useMemo(() => {
    const options = [{ id: DEFAULT_MODEL, name: DEFAULT_MODEL }, ...models];
    const seen = new Set<string>();

    return options.filter((model) => {
      if (seen.has(model.id)) {
        return false;
      }

      seen.add(model.id);
      return true;
    });
  }, [models]);

  const selectedModelLabel = useMemo(
    () =>
      modelOptions.find((model) => model.id === selectedModel)?.name ??
      selectedModel,
    [modelOptions, selectedModel],
  );

  const createChat = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel }),
    });
    const data = (await response.json()) as { chat?: ChatSummary } & ApiError;

    if (!response.ok || !data.chat) {
      throw new Error(data.error ?? "Unable to create chat.");
    }

    setChats((current) => [data.chat!, ...current]);
    setActiveChatId(data.chat.id);
    setMessages([]);
    setSelectedModel(data.chat.model);
    return data.chat;
  }, [selectedModel]);

  const openChat = useCallback(async (chatId: string) => {
    setIsLoadingChat(true);
    setError(null);

    try {
      const response = await fetch(`/api/chats/${chatId}`);
      const data = (await response.json()) as { chat?: ChatDetail } & ApiError;

      if (!response.ok || !data.chat) {
        throw new Error(data.error ?? "Unable to load chat.");
      }

      setActiveChatId(data.chat.id);
      setMessages(data.chat.messages);
      setSelectedModel(data.chat.model);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoadingChat(false);
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const response = await fetch("/api/models");
      const data = (await response.json()) as { models?: OpenRouterModel[] } & ApiError;

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load models.");
      }

      setModels(data.models ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  const loadCredits = useCallback(async () => {
    setCreditsLoading(true);
    setCreditsError(null);

    try {
      const response = await fetch("/api/credits", { cache: "no-store" });
      const data = (await response.json()) as {
        credits?: OpenRouterCredits;
      } & ApiError;

      if (!response.ok || !data.credits) {
        throw new Error(data.error ?? "Unable to load credits.");
      }

      setCredits(data.credits);
    } catch (err) {
      setCreditsError(getErrorMessage(err));
      setCredits(null);
    } finally {
      setCreditsLoading(false);
    }
  }, []);

  const loadChats = useCallback(async () => {
    try {
      const response = await fetch("/api/chats");
      const data = (await response.json()) as { chats?: ChatSummary[] } & ApiError;

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load chats.");
      }

      const nextChats = data.chats ?? [];
      setChats(nextChats);

      if (nextChats[0]) {
        await openChat(nextChats[0].id);
      } else {
        const response = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: DEFAULT_MODEL }),
        });
        const data = (await response.json()) as { chat?: ChatSummary } & ApiError;

        if (!response.ok || !data.chat) {
          throw new Error(data.error ?? "Unable to create chat.");
        }

        setChats([data.chat]);
        setActiveChatId(data.chat.id);
        setMessages([]);
        setSelectedModel(data.chat.model);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [openChat]);

  // Client-side bootstrapping is intentional here because the chat shell owns
  // model/chat loading and optimistic state.
  useEffect(() => {
    if (didBootstrapRef.current) {
      return;
    }

    didBootstrapRef.current = true;
    setSidebarOpen(window.matchMedia("(min-width: 1024px)").matches);
    void loadModels();
    void loadCredits();
    void loadChats();
  }, [loadChats, loadCredits, loadModels]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(event.target as Node)
      ) {
        setModelMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  async function handleImageFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setError(null);

    try {
      const nextImages = await Promise.all(
        Array.from(files).map(async (file, index) => {
          if (!allowedImageTypes.includes(file.type)) {
            throw new Error("Only PNG, JPEG, WEBP, and GIF images are supported.");
          }

          if (file.size > maxImageSize) {
            throw new Error("Images must be 5 MB or smaller.");
          }

          return {
            id: `local-image-${localIdRef.current + index + 1}`,
            name: file.name,
            mimeType: file.type,
            dataUrl: await readFileAsDataUrl(file),
          };
        }),
      );

      localIdRef.current += nextImages.length;
      setSelectedImages((current) => [...current, ...nextImages]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  function removeSelectedImage(imageId: string) {
    setSelectedImages((current) =>
      current.filter((image) => image.id !== imageId),
    );
  }

  function cancelSend() {
    sendAbortControllerRef.current?.abort();
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();

    const content = input.trim();
    if ((!content && selectedImages.length === 0) || isSending) {
      return;
    }

    let chatId = activeChatId;
    let pendingImages: ChatAttachment[] = [];
    const shouldUseWebSearch = webSearchEnabled;
    setError(null);

    try {
      if (!chatId) {
        const chat = await createChat();
        chatId = chat.id;
      }

      if (!chatId) {
        throw new Error("No active chat.");
      }

      const attachments = selectedImages;
      pendingImages = attachments;
      setInput("");
      setSelectedImages([]);
      setWebSearchEnabled(false);
      setIsSending(true);

      const localId = localIdRef.current + 1;
      localIdRef.current = localId;
      const createdAt = new Date().toISOString();
      const optimisticUserMessage: ChatMessage = {
        id: `local-user-${localId}`,
        chatId,
        role: "user",
        content,
        createdAt,
        attachments,
      };
      const assistantMessageId = `local-assistant-${localId}`;
      const optimisticAssistantMessage: ChatMessage = {
        id: assistantMessageId,
        chatId,
        role: "assistant",
        content: "",
        createdAt,
        attachments: [],
      };

      setMessages((current) => [
        ...current,
        optimisticUserMessage,
        optimisticAssistantMessage,
      ]);

      const abortController = new AbortController();
      sendAbortControllerRef.current = abortController;

      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          content,
          model: selectedModel,
          think: thinkEnabled,
          webSearch: shouldUseWebSearch,
          attachments: attachments.map((image) => ({
            name: image.name,
            mimeType: image.mimeType,
            dataUrl: image.dataUrl,
          })),
        }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as ApiError;
        throw new Error(data.error ?? "Unable to send message.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: message.content + chunk }
              : message,
          ),
        );
      }

      await refreshChatList(chatId);
    } catch (err) {
      if (isAbortError(err)) {
        if (chatId) {
          await openChat(chatId);
        } else {
          setMessages((current) =>
            current.filter((message) => !message.id.startsWith("local-")),
          );
        }
        return;
      }

      setError(getErrorMessage(err));
      setSelectedImages((current) => (current.length ? current : pendingImages));
      setMessages((current) =>
        current.filter((message) => !message.id.startsWith("local-")),
      );
    } finally {
      sendAbortControllerRef.current = null;
      setIsSending(false);
    }
  }

  async function refreshChatList(focusChatId: string) {
    const response = await fetch("/api/chats");
    const data = (await response.json()) as { chats?: ChatSummary[] } & ApiError;

    if (response.ok && data.chats) {
      setChats(data.chats);
      setActiveChatId(focusChatId);
    }
  }

  async function updateChatModel(model: string) {
    setSelectedModel(model);
    setModelMenuOpen(false);

    if (!activeChatId) {
      return;
    }

    const response = await fetch(`/api/chats/${activeChatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    const data = (await response.json()) as { chat?: ChatSummary } & ApiError;

    if (!response.ok || !data.chat) {
      setError(data.error ?? "Unable to update model.");
      return;
    }

    setChats((current) =>
      current.map((chat) => (chat.id === data.chat!.id ? data.chat! : chat)),
    );
  }

  async function renameChat(chatId: string) {
    const title = renameValue.trim();
    if (!title) {
      return;
    }

    const response = await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = (await response.json()) as { chat?: ChatSummary } & ApiError;

    if (!response.ok || !data.chat) {
      setError(data.error ?? "Unable to rename chat.");
      return;
    }

    setChats((current) =>
      current.map((chat) => (chat.id === data.chat!.id ? data.chat! : chat)),
    );
    setRenamingChatId(null);
  }

  async function deleteChat(chatId: string) {
    const response = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
    const data = (await response.json()) as ApiError;

    if (!response.ok) {
      setError(data.error ?? "Unable to delete chat.");
      return;
    }

    const remainingChats = chats.filter((chat) => chat.id !== chatId);
    setChats(remainingChats);
    setChatToDelete(null);

    if (activeChatId === chatId) {
      if (remainingChats[0]) {
        await openChat(remainingChats[0].id);
      } else {
        await createChat();
      }
    }
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-[#0b0c0c] text-[#f3f3f1]">
      <aside className="hidden h-dvh w-[74px] shrink-0 flex-col items-center border-r border-[#242424] bg-[#171818] py-6 md:flex">
        <div
          aria-label="AI Chat"
          className="grid size-11 place-items-center rounded-lg bg-[#f4f4f0] text-[#151515]"
          title="AI Chat"
        >
          <Bot size={22} />
        </div>
      </aside>

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-30 flex h-dvh w-[min(20rem,calc(100vw-1rem))] flex-col overflow-hidden border-r border-[#242424] bg-[#171818] transition-[transform,opacity] duration-300 ease-out md:left-[74px] lg:static lg:transition-[width,opacity,border-color]",
          sidebarOpen
            ? "translate-x-0 opacity-100 lg:w-80 lg:border-[#242424]"
            : "-translate-x-full opacity-0 lg:w-0 lg:translate-x-0 lg:border-transparent",
        )}
        aria-hidden={!sidebarOpen}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#242424] px-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7d7d7d]">
              Workspace
            </p>
            <h1 className="text-base font-semibold">Conversations</h1>
          </div>
          <button
            className="grid size-10 place-items-center rounded-lg bg-[#242424] text-[#d7d7d2] hover:bg-[#2f2f2f]"
            onClick={() => void createChat().catch((err) => setError(getErrorMessage(err)))}
            title="New chat"
            type="button"
          >
            <MessageSquarePlus size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {chats.map((chat) => (
            <div
              className={clsx(
                "group mb-2 rounded-lg border p-2.5",
                chat.id === activeChatId
                  ? "border-[#3a3a3a] bg-[#222323]"
                  : "border-transparent hover:border-[#2c2c2c] hover:bg-[#1f2020]",
              )}
              key={chat.id}
            >
              {renamingChatId === chat.id ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void renameChat(chat.id);
                  }}
                >
                  <input
                    autoFocus
                    className="min-w-0 flex-1 rounded-md border border-[#3a3a3a] bg-[#101111] px-2 py-1 text-sm text-[#f3f3f1] outline-none transition focus:border-[#4a4a4a] focus:bg-[#151616] focus-visible:outline-none focus-visible:ring-0"
                    onChange={(event) => setRenameValue(event.target.value)}
                    value={renameValue}
                  />
                  <button
                    className="grid size-8 place-items-center rounded-md bg-[#f4f4f0] text-[#101111]"
                    title="Save title"
                    type="submit"
                  >
                    <Check size={16} />
                  </button>
                </form>
              ) : (
                <div className="flex items-start gap-2">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => void openChat(chat.id)}
                    type="button"
                  >
                    <p className="truncate text-sm font-medium">{chat.title}</p>
                    <p className="truncate text-xs text-[#818181]">{chat.model}</p>
                  </button>
                  <button
                    aria-label={`Rename ${chat.title}`}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-[#8f8f8f] opacity-100 hover:bg-[#2c2c2c] hover:text-[#f3f3f1] lg:opacity-0 lg:group-hover:opacity-100"
                    onClick={() => {
                      setRenamingChatId(chat.id);
                      setRenameValue(chat.title);
                    }}
                    title="Rename chat"
                    type="button"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    aria-label={`Delete ${chat.title}`}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-[#d36d62] opacity-100 hover:bg-[#341f1d] lg:opacity-0 lg:group-hover:opacity-100"
                    onClick={() => setChatToDelete(chat)}
                    title="Delete chat"
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-[#242424] p-2.5">
          <div className="rounded-lg border border-[#2a2a2a] bg-[#101111] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d7d7d]">
                Credits
              </p>
              <button
                className="grid size-7 place-items-center rounded-md text-[#8f8f8f] hover:bg-[#242525] hover:text-[#f3f3f1]"
                onClick={() => void loadCredits()}
                title="Refresh credits"
                type="button"
              >
                <RefreshCw
                  className={clsx(creditsLoading && "animate-spin")}
                  size={13}
                />
              </button>
            </div>

            {credits ? (
              <>
                <p
                  className={clsx(
                    "text-lg font-semibold leading-6",
                    credits.remaining < 0 ? "text-[#ff9f92]" : "text-[#f3f3f1]",
                  )}
                >
                  {formatCredits(credits.remaining)}
                </p>
                <p className="text-[11px] leading-4 text-[#858585]">
                  Used {formatCredits(credits.totalUsage)} of{" "}
                  {formatCredits(credits.totalCredits)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-[11px] leading-4 text-[#858585]">
                {creditsLoading
                  ? "Checking balance..."
                  : creditsError ?? "Credits unavailable."}
              </p>
            )}
          </div>
        </div>
      </aside>

      {chatToDelete && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-lg border border-[#303030] bg-[#171818] p-4 shadow-2xl shadow-black/60">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#341f1d] text-[#ff9f92]">
                <Trash2 size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#f3f3f1]">
                  Delete this chat?
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#a4a4a0]">
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-[#f3f3f1]">
                    {chatToDelete.title}
                  </span>
                  ? This cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-[#303030] px-3 py-2 text-sm text-[#d7d7d2] hover:bg-[#242525]"
                onClick={() => setChatToDelete(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[#d36d62] px-3 py-2 text-sm font-medium text-[#111] hover:bg-[#ed8175]"
                onClick={() => void deleteChat(chatToDelete.id)}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {sidebarOpen && (
        <button
          aria-label="Close sidebar"
          className="fixed inset-0 z-20 bg-black/70 md:left-[74px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      )}

      <section className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-[#0c0d0d]">
        <header className="flex min-h-16 items-center gap-2 border-b border-[#1e1e1e] bg-[#0c0d0d]/95 px-3 py-3 sm:gap-3 sm:px-4">
          <button
            className="grid size-10 shrink-0 place-items-center rounded-lg text-[#b7b7b1] hover:bg-[#1d1d1d]"
            onClick={() => setSidebarOpen((open) => !open)}
            title="Toggle chats"
            type="button"
          >
            <PanelLeft size={19} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#f3f3f1]">
              {activeChat?.title ?? "New chat"}
            </p>
            <p className="truncate text-xs text-[#787878]">
              {messages.length} messages
            </p>
          </div>

          <div className="relative shrink-0" ref={modelMenuRef}>
            <button
              aria-expanded={modelMenuOpen}
              aria-label={`Select model: ${selectedModelLabel}`}
              className="flex h-10 max-w-[46vw] items-center justify-between gap-1.5 rounded-full border border-[#262626] bg-[#181919] px-3 text-left text-xs font-medium text-[#d8d8d3] outline-none transition hover:border-[#3a3a3a] hover:bg-[#202121] focus:border-[#4a4a4a] focus:bg-[#202121] focus-visible:outline-none focus-visible:ring-0 sm:w-[280px] sm:max-w-none sm:gap-2 sm:px-4 sm:text-sm"
              onClick={() => setModelMenuOpen((open) => !open)}
              title={`Select model: ${selectedModelLabel}`}
              type="button"
            >
              <span className="truncate">{selectedModelLabel}</span>
              <ChevronDown
                className={clsx(
                  "shrink-0 text-[#8a8a8a] transition-transform duration-200",
                  modelMenuOpen && "rotate-180",
                )}
                size={15}
              />
            </button>

            {modelMenuOpen && (
              <div className="absolute right-0 top-12 z-40 w-[min(320px,calc(100vw-1.5rem))] origin-top-right overflow-hidden rounded-2xl border border-[#303030] bg-[#171818] shadow-2xl shadow-black/50 [animation:dropdown-in_160ms_ease-out] sm:w-[min(420px,calc(100vw-2rem))]">
                <div className="border-b border-[#262626] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7d7d7d]">
                    Select model
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {modelOptions.map((model) => {
                    const isSelected = model.id === selectedModel;

                    return (
                      <button
                        className={clsx(
                          "flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition",
                          isSelected
                            ? "bg-[#f4f4f0] text-[#111]"
                            : "text-[#d8d8d3] hover:bg-[#242525]",
                        )}
                        key={model.id}
                        onClick={() => void updateChatModel(model.id)}
                        type="button"
                      >
                        <span className="max-w-full truncate text-sm font-medium">
                          {model.name}
                        </span>
                        <span
                          className={clsx(
                            "mt-0.5 max-w-full truncate text-xs",
                            isSelected ? "text-[#555]" : "text-[#858585]",
                          )}
                        >
                          {model.id}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </header>

        {error && (
          <div className="border-b border-[#5d302a] bg-[#2d1715] px-4 py-3 text-sm text-[#ffb7aa]">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-8">
          <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col">
            {isLoadingChat ? (
              <div className="flex items-center gap-2 text-sm text-[#858585]">
                <Loader2 className="animate-spin" size={16} />
                Loading chat
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-1 flex-col justify-center pb-4 sm:pb-8">
                <div className="max-w-3xl">
                  <h2 className="text-3xl font-semibold leading-tight text-[#a6a6a3] sm:text-5xl">
                    Hi there,
                    <span className="block text-[#d7d7d2]">
                      What would you like to know?
                    </span>
                  </h2>
                  <p className="mt-4 max-w-md text-base leading-7 text-[#a4a4a0] sm:mt-6 sm:text-lg">
                    Use one of the most common prompts below or use your own to
                    begin.
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:mt-7 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                  {promptCards.map((prompt, index) => (
                    <button
                      className="flex min-h-24 flex-col justify-between rounded-lg border border-[#2a2a2a] bg-[#101111] p-3 text-left text-sm leading-5 text-[#d7d7d2] transition hover:border-[#4a4a4a] hover:bg-[#171818] sm:min-h-32 sm:p-4 [animation:prompt-card-in_180ms_ease-out]"
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      type="button"
                    >
                      <span>{prompt}</span>
                      {index === 0 ? (
                        <Check className="text-[#9c9c9c]" size={19} />
                      ) : index === 1 ? (
                        <Bot className="text-[#9c9c9c]" size={19} />
                      ) : index === 2 ? (
                        <ImageIcon className="text-[#9c9c9c]" size={19} />
                      ) : (
                        <SlidersHorizontal className="text-[#9c9c9c]" size={19} />
                      )}
                    </button>
                  ))}
                </div>

                <button
                  className="mt-5 flex w-fit items-center gap-2 text-sm text-[#777] hover:text-[#d7d7d2]"
                  onClick={() =>
                    setPromptSetIndex((index) => (index + 1) % promptSets.length)
                  }
                  type="button"
                >
                  <RefreshCw size={16} />
                  Refresh Prompts
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            )}
            {isSending && (
              <div className="mt-5 flex items-center gap-3 text-sm text-[#858585]">
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  Streaming response
                </span>
                <button
                  className="flex items-center gap-1.5 rounded-md border border-[#3a3a3a] px-2 py-1 text-xs text-[#d7d7d2] hover:bg-[#242525]"
                  onClick={cancelSend}
                  type="button"
                >
                  <SquareStop size={13} />
                  Stop
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <form className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-8" onSubmit={sendMessage}>
          <div className="mx-auto max-w-5xl rounded-2xl border border-[#2d2d2d] bg-[#181919] p-3 shadow-2xl shadow-black/30 sm:p-4">
            <input
              ref={imageInputRef}
              accept={allowedImageTypes.join(",")}
              className="hidden"
              multiple
              onChange={(event) => void handleImageFiles(event.target.files)}
              type="file"
            />

            {selectedImages.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedImages.map((image) => (
                  <div
                    className="group relative size-16 overflow-hidden rounded-lg border border-[#2d2d2d] bg-[#101111] sm:size-20"
                    key={image.id}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={image.name}
                      className="size-full object-cover"
                      src={image.dataUrl}
                    />
                    <button
                      className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-[#f3f3f1] opacity-100 transition hover:bg-black sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => removeSelectedImage(image.id)}
                      title={`Remove ${image.name}`}
                      type="button"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-start gap-2 sm:gap-3">
              <textarea
                className="min-h-16 flex-1 resize-none bg-transparent px-1 py-2 text-base leading-6 text-[#f3f3f1] outline-none placeholder:text-[#8d8d8a] sm:min-h-20 sm:text-sm"
                disabled={isSending}
                maxLength={maxMessageLength}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Ask whatever you want..."
                rows={3}
                value={input}
              />
              <div className="hidden shrink-0 flex-col gap-2 sm:flex">
                <button
                  className={clsx(
                    "flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm transition",
                    thinkEnabled
                      ? "bg-[#f4f4f0] text-[#111]"
                      : "bg-[#242525] text-[#b8b8b3] hover:text-[#f3f3f1]",
                  )}
                  onClick={() => setThinkEnabled((enabled) => !enabled)}
                  type="button"
                >
                  <Sparkles size={16} />
                  Think
                </button>
                <button
                  className={clsx(
                    "flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm transition",
                    webSearchEnabled
                      ? "bg-[#f4f4f0] text-[#111]"
                      : "bg-[#242525] text-[#b8b8b3] hover:text-[#f3f3f1]",
                  )}
                  onClick={() => setWebSearchEnabled((enabled) => !enabled)}
                  title="Use web search"
                  type="button"
                >
                  <Globe2 size={16} />
                  Search
                </button>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2 text-sm text-[#858585]">
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pr-1 sm:gap-5 sm:overflow-visible sm:pr-0">
                <button
                  aria-label="Add attachment"
                  className="flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-[#242525] hover:text-[#d7d7d2] sm:h-9 sm:w-auto sm:gap-2 sm:px-2"
                  onClick={() => imageInputRef.current?.click()}
                  title="Add attachment"
                  type="button"
                >
                  <Paperclip size={16} />
                  <span className="hidden sm:inline">Add</span>
                </button>
                <button
                  aria-label="Use image"
                  className="flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-[#242525] hover:text-[#d7d7d2] sm:h-9 sm:w-auto sm:gap-2 sm:px-2"
                  onClick={() => imageInputRef.current?.click()}
                  title="Use image"
                  type="button"
                >
                  <ImageIcon size={16} />
                  <span className="hidden sm:inline">Image</span>
                </button>
                <button
                  aria-label="Think"
                  className={clsx(
                    "flex size-9 shrink-0 items-center justify-center rounded-md sm:hidden",
                    thinkEnabled
                      ? "bg-[#f4f4f0] text-[#111]"
                      : "hover:bg-[#242525] hover:text-[#d7d7d2]",
                  )}
                  onClick={() => setThinkEnabled((enabled) => !enabled)}
                  title="Think"
                  type="button"
                >
                  <Sparkles size={16} />
                </button>
                <button
                  aria-label="Use web search"
                  className={clsx(
                    "flex size-9 shrink-0 items-center justify-center rounded-md sm:hidden",
                    webSearchEnabled
                      ? "bg-[#f4f4f0] text-[#111]"
                      : "hover:bg-[#242525] hover:text-[#d7d7d2]",
                  )}
                  onClick={() => setWebSearchEnabled((enabled) => !enabled)}
                  title="Use web search"
                  type="button"
                >
                  <Globe2 size={16} />
                </button>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <span className="text-xs tabular-nums sm:text-sm">
                  {input.length}/{maxMessageLength}
                </span>
                {isSending ? (
                  <button
                    className="grid size-10 place-items-center rounded-lg bg-[#342322] text-[#ffb7aa] transition hover:bg-[#452a28]"
                    onClick={cancelSend}
                    title="Stop response"
                    type="button"
                  >
                    <SquareStop size={18} />
                  </button>
                ) : (
                  <button
                    className="grid size-10 place-items-center rounded-lg bg-[#f4f4f0] text-[#111] transition hover:bg-white disabled:cursor-not-allowed disabled:bg-[#3a3a3a] disabled:text-[#888]"
                    disabled={!input.trim() && selectedImages.length === 0}
                    title="Send message"
                    type="submit"
                  >
                    <Send size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [messageCopied, setMessageCopied] = useState(false);

  async function copyMessage() {
    await copyToClipboard(message.content);
    setMessageCopied(true);
    window.setTimeout(() => setMessageCopied(false), 1200);
  }

  return (
    <article
      className={clsx(
        "group flex min-w-0",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div className="min-w-0 max-w-[min(760px,100%)]">
        <div
          className={clsx(
            "min-w-0 overflow-hidden rounded-md border px-3 py-3 text-sm leading-6 sm:px-4",
            isUser
              ? "border-[#3a3a3a] bg-[#242525] text-[#f3f3f1]"
              : "border-[#262626] bg-[#141515] text-[#e6e6e1]",
          )}
        >
          {isUser ? (
            <div className="space-y-3">
              {message.attachments.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {message.attachments.map((attachment) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={attachment.name}
                      className="max-h-64 w-full rounded-md object-cover"
                      key={attachment.id}
                      src={attachment.dataUrl}
                    />
                  ))}
                </div>
              )}
              {message.content && (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              )}
            </div>
          ) : (
            <div className="prose prose-sm max-w-none break-words prose-invert prose-headings:text-[#f3f7f1] prose-a:text-[#d7d7d2] prose-strong:text-[#f3f7f1] prose-code:text-[#f0f0ec] prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0">
              {message.content ? (
                <ReactMarkdown
                  components={{
                    code: CodeBlock,
                  }}
                  remarkPlugins={[remarkGfm]}
                >
                  {message.content}
                </ReactMarkdown>
              ) : (
                <span className="text-[#8ca194]">Thinking...</span>
              )}
            </div>
          )}
        </div>

        {message.content && (
          <div
            className={clsx(
              "mt-2 flex opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100",
              isUser ? "justify-end" : "justify-start",
            )}
          >
            <button
              aria-label={messageCopied ? "Copied" : "Copy message"}
              className="grid size-8 place-items-center rounded-md text-[#858585] transition hover:bg-[#202121] hover:text-[#d7d7d2] sm:flex sm:size-auto sm:items-center sm:gap-1.5 sm:px-2 sm:py-1 sm:text-xs"
              onClick={() => void copyMessage()}
              type="button"
            >
              {messageCopied ? (
                <ClipboardCheck size={14} />
              ) : (
                <Clipboard size={14} />
              )}
              <span className="hidden sm:inline">
                {messageCopied ? "Copied" : "Copy"}
              </span>
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function CodeBlock({ children, className }: CodeComponentProps) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? "").replace(/\n$/, "");
  const language = className?.match(/language-(\w+)/)?.[1];

  async function copyCode() {
    await copyToClipboard(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  if (!className) {
    return (
      <code className="rounded bg-[#242525] px-1.5 py-0.5 text-[#f0f0ec]">
        {children}
      </code>
    );
  }

  return (
    <div className="my-4 min-w-0 overflow-hidden rounded-lg border border-[#2f2f2f] bg-[#0d0e0e]">
      <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#181919] px-3 py-2">
        <span className="min-w-0 truncate text-xs font-medium uppercase tracking-[0.12em] text-[#858585]">
          {language ?? "code"}
        </span>
        <button
          className="ml-2 flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[#a7a7a2] transition hover:bg-[#242525] hover:text-[#f3f3f1]"
          onClick={() => void copyCode()}
          type="button"
        >
          {copied ? <ClipboardCheck size={14} /> : <Clipboard size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-6 text-[#f0f0ec]">
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read image."));
      }
    });
    reader.addEventListener("error", () => reject(new Error("Unable to read image.")));
    reader.readAsDataURL(file);
  });
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatCredits(value: number) {
  return creditFormatter.format(value);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
