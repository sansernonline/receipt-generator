"use client";

import { useEffect, useRef, useState } from "react";
import { ChatList } from "./chat-list";
import { ChatPane, type ChatMessage } from "./chat-pane";
import type { ChatListItem } from "./group-chats";
import { stageOf, type ChatStage } from "./quick-chips";

export function ChatShell() {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasListError, setHasListError] = useState(false);
  const [hasCreateError, setHasCreateError] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<ChatStage>("no-shop");
  const [hasSendError, setHasSendError] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const latestOpen = useRef(0); // only the last chat the user clicked may fill the screen
  const [isBusy, setIsBusy] = useState(true); // true while loading the list, so a late list cannot overwrite a new chat

  useEffect(() => {
    fetch("/api/chats")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("list failed"))))
      .then((body) => (Array.isArray(body?.chats) ? setChats(body.chats) : Promise.reject(new Error("bad list"))))
      .catch(() => setHasListError(true)) // the user can still start a chat
      .finally(() => setIsBusy(false));
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setIsDrawerOpen(false);
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isDrawerOpen]);

  // a late list response can already contain the chat, so never add the same id twice
  const putOnTop = (chat: ChatListItem) => setChats((current) => [chat, ...current.filter((item) => item.id !== chat.id)]);

  function showChat(id: string, shownMessages: ChatMessage[], shownStage: ChatStage = "no-shop") {
    latestOpen.current += 1; // a reply still on its way for an earlier click is now out of date
    setActiveId(id);
    setMessages(shownMessages);
    setStage(shownStage);
    setText("");
    setOpenError(null);
    setHasSendError(false);
    setIsDrawerOpen(false);
  }

  async function createChat(): Promise<string> {
    const res = await fetch("/api/chats", { method: "POST" });
    if (!res.ok) throw new Error("create failed");
    const { chat } = await res.json();
    putOnTop(chat);
    showChat(chat.id, []);
    return chat.id;
  }

  async function startNewChat() {
    setIsBusy(true);
    setHasCreateError(false);
    try {
      await createChat();
    } catch {
      setHasCreateError(true);
    } finally {
      setIsBusy(false);
    }
  }

  async function openChat(id: string) {
    const ticket = ++latestOpen.current;
    setIsDrawerOpen(false);
    try {
      const res = await fetch(`/api/chats/${id}`);
      const body = await res.json().catch(() => null);
      if (ticket !== latestOpen.current) return;
      if (!res.ok) return setOpenError(typeof body?.error === "string" ? body.error : "เปิดแชตไม่ได้ ลองอีกครั้ง");
      showChat(id, body.chat.messages, stageOf(body.chat, body.draft));
    } catch {
      if (ticket === latestOpen.current) setOpenError("เปิดแชตไม่ได้ ลองอีกครั้ง");
    }
  }

  async function sendMessage() {
    const sentText = text;
    setIsBusy(true);
    setHasSendError(false);
    try {
      const chatId = activeId ?? (await createChat());
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: sentText }),
      });
      if (!res.ok) throw new Error("send failed");
      const { chat, message } = await res.json();
      putOnTop(chat);
      setMessages((current) => [...current, message]);
      setText((current) => (current === sentText ? "" : current)); // keep what was typed while sending
    } catch {
      setHasSendError(true); // the text stays in the box so nothing typed is lost
    } finally {
      setIsBusy(false);
    }
  }

  const active = chats.find((chat) => chat.id === activeId);

  return (
    <div className="h-screen bg-desk p-0 lg:p-2.5">
      <div className="relative grid h-full overflow-hidden bg-white lg:grid-cols-[288px_minmax(440px,1.1fr)_minmax(360px,560px)] lg:rounded-2xl lg:border lg:border-line lg:shadow-sm">
        <ChatList chats={chats} activeId={activeId} now={new Date()} isBusy={isBusy} isDrawerOpen={isDrawerOpen} hasListError={hasListError} hasCreateError={hasCreateError} onNewChat={startNewChat} onOpen={openChat} />
        <ChatPane title={active?.title ?? "แชตใหม่"} messages={messages} text={text} stage={stage} isBusy={isBusy} hasSendError={hasSendError} openError={openError} onOpenDrawer={() => setIsDrawerOpen(true)} onTextChange={setText} onFillText={setText} onSend={sendMessage} />
        {isDrawerOpen && <button type="button" aria-label="ปิดประวัติแชต" onClick={() => setIsDrawerOpen(false)} className="absolute inset-0 z-40 bg-black/40 lg:hidden" />}
        <section aria-label="ตัวอย่างบิล" className="hidden items-center justify-center border-l border-line bg-desk text-sm text-ink-3 lg:flex">
          ตัวอย่างบิลจะแสดงที่นี่
        </section>
      </div>
    </div>
  );
}
