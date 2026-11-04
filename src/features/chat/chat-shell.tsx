"use client";

import { useEffect, useState } from "react";
import { ChatList } from "./chat-list";
import { ChatPane } from "./chat-pane";
import type { ChatListItem } from "./group-chats";

export function ChatShell() {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasListError, setHasListError] = useState(false);
  const [hasCreateError, setHasCreateError] = useState(false);
  const [isBusy, setIsBusy] = useState(true); // true while loading the list, so a late list cannot overwrite a new chat

  useEffect(() => {
    fetch("/api/chats")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("list failed"))))
      .then((body) => (Array.isArray(body?.chats) ? setChats(body.chats) : Promise.reject(new Error("bad list"))))
      .catch(() => setHasListError(true)) // the user can still start a chat
      .finally(() => setIsBusy(false));
  }, []);

  async function startNewChat() {
    setIsBusy(true);
    setHasCreateError(false);
    try {
      const res = await fetch("/api/chats", { method: "POST" });
      if (!res.ok) throw new Error("create failed");
      const { chat } = await res.json();
      setChats((current) => [chat, ...current]);
      setActiveId(chat.id);
    } catch {
      setHasCreateError(true);
    } finally {
      setIsBusy(false);
    }
  }

  const active = chats.find((chat) => chat.id === activeId);

  return (
    <div className="h-screen bg-desk p-0 lg:p-2.5">
      <div className="grid h-full overflow-hidden bg-white lg:grid-cols-[288px_minmax(440px,1.1fr)_minmax(360px,560px)] lg:rounded-2xl lg:border lg:border-line lg:shadow-sm">
        <ChatList chats={chats} activeId={activeId} now={new Date()} isBusy={isBusy} hasListError={hasListError} hasCreateError={hasCreateError} onNewChat={startNewChat} />
        <ChatPane title={active?.title ?? "แชตใหม่"} />
        <section aria-label="ตัวอย่างบิล" className="hidden items-center justify-center border-l border-line bg-desk text-sm text-ink-3 lg:flex">
          ตัวอย่างบิลจะแสดงที่นี่
        </section>
      </div>
    </div>
  );
}
