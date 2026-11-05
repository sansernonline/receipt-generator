"use client";

import { useEffect, useRef, useState } from "react";
import { AiNoticeDialog } from "./ai-notice-dialog";
import { ChatActions } from "./chat-actions";
import { ChatList } from "./chat-list";
import { acknowledgeAiNotice, hasAcknowledgedAiNotice } from "../consent/ai-notice-flag";
import { BillPreview } from "../bill/bill-preview";
import { fetchBill, parseBill } from "../bill/fetch-bill";
import type { BillData } from "../bill/types";
import { ChatPane, type ChatMessage } from "./chat-pane";
import type { ChatListItem } from "./group-chats";
import { AiWaitTimeout, postMessage } from "./post-message";
import { stageOf, type ChatStage } from "./quick-chips";

const SEND_FAILED = "ส่งข้อความไม่สำเร็จ ลองอีกครั้ง";
// the draft may have changed on the server by now, so this text must not say it is unchanged (mockup #s-err-ai says so only for the server's own "AI unreachable" notice)
const AI_TIMED_OUT = "ยังไม่ได้รับคำตอบจาก AI ตรวจร่างบิลก่อนสั่งต่อ แล้วลองส่งอีกครั้งได้";
const CONSENT_SAVE_LIMIT_MS = 10_000; // a hung request must not keep the notice locked: cancel and accept are off while saving
const NOTICE_SAVE_FAILED = "บันทึกการรับทราบไม่สำเร็จ ลองอีกครั้ง";

export function ChatShell() {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasListError, setHasListError] = useState(false);
  const [hasCreateError, setHasCreateError] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<ChatStage>("no-shop");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [isNoticeSaving, setIsNoticeSaving] = useState(false);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [bill, setBill] = useState<BillData | null>(null);
  const [hasBillError, setHasBillError] = useState(false);
  const [isBillTab, setIsBillTab] = useState(false); // phone only: one of chat / bill fills the screen
  const newChatRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const wasDrawerOpen = useRef(false);
  const latestOpen = useRef(0); // only the last chat the user clicked may fill the screen
  const [isBusy, setIsBusy] = useState(true); // true while loading the list, so a late list cannot overwrite a new chat

  useEffect(() => {
    fetch("/api/chats")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("list failed"))))
      .then((body) => (Array.isArray(body?.chats) ? setChats(body.chats) : Promise.reject(new Error("bad list"))))
      .catch(() => setHasListError(true)) // the user can still start a chat
      .finally(() => setIsBusy(false));
  }, []);

  // keyboard users: focus goes into the drawer when it opens and back to the menu button when it closes
  useEffect(() => {
    if (isDrawerOpen) newChatRef.current?.focus();
    else if (wasDrawerOpen.current) menuRef.current?.focus();
    wasDrawerOpen.current = isDrawerOpen;
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setIsDrawerOpen(false);
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isDrawerOpen]);

  // a late list response can already contain the chat, so never add the same id twice
  const putOnTop = (chat: ChatListItem) => setChats((current) => [chat, ...current.filter((item) => item.id !== chat.id)]);

  function showChat(id: string | null, shownMessages: ChatMessage[], shownStage: ChatStage = "no-shop") {
    latestOpen.current += 1; // a reply still on its way for an earlier click is now out of date
    setActiveId(id);
    setMessages(shownMessages);
    setStage(shownStage);
    setText("");
    setOpenError(null);
    setSendError(null);
    setIsSending(false); // the waiting status belongs to the chat the message was sent from
    setBill(null);
    setHasBillError(false);
    setIsDrawerOpen(false);
  }

  function removeChat(id: string) {
    setChats((current) => current.filter((chat) => chat.id !== id));
    showChat(null, []); // the deleted chat was the open one; sending a message now starts a new chat
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

  function loadBill(id: string) {
    const ticket = latestOpen.current;
    fetchBill(id).then(
      (loaded) => ticket === latestOpen.current && setBill(loaded),
      () => ticket === latestOpen.current && setHasBillError(true),
    );
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
      loadBill(id);
    } catch {
      if (ticket === latestOpen.current) setOpenError("เปิดแชตไม่ได้ ลองอีกครั้ง");
    }
  }

  // the box is cleared and the user's bubble shows at once; if sending fails both are put back
  async function sendMessage() {
    const sentText = text;
    const shown = activeId ? messages : [];
    setIsBusy(true);
    setIsSending(true);
    setSendError(null);
    let ticket = latestOpen.current;
    try {
      const chatId = activeId ?? (await createChat());
      ticket = latestOpen.current;
      setMessages([...shown, { role: "user", text: sentText }]);
      setText("");
      const answer = await postMessage(chatId, sentText);
      putOnTop(answer.chat); // the reply is stored on the server; opening that chat again shows it
      if (ticket !== latestOpen.current) return;
      setMessages([...shown, ...answer.messages, ...answer.notices.map((notice) => ({ role: "notice", text: notice }))]);
      setBill((current) => parseBill(answer) ?? current);
    } catch (error) {
      if (ticket !== latestOpen.current) return; // the user is on another chat now; its screen is not ours to change
      setMessages(shown);
      setText((current) => current || sentText);
      setSendError(error instanceof AiWaitTimeout ? AI_TIMED_OUT : SEND_FAILED);
    } finally {
      setIsSending(false);
      setIsBusy(false);
    }
  }

  // nothing leaves this machine for the AI before the user has seen the notice (NFR-PDPA-030)
  function requestSend() {
    if (hasAcknowledgedAiNotice()) void sendMessage();
    else {
      setNoticeError(null);
      setIsNoticeOpen(true);
    }
  }

  async function acceptNotice() {
    setIsNoticeSaving(true);
    setNoticeError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONSENT_SAVE_LIMIT_MS);
    try {
      const res = await fetch("/api/consent", { method: "POST", signal: controller.signal });
      if (!res.ok) throw new Error("consent failed");
    } catch {
      setNoticeError(NOTICE_SAVE_FAILED);
      return;
    } finally {
      clearTimeout(timer);
      setIsNoticeSaving(false);
    }
    acknowledgeAiNotice();
    setIsNoticeOpen(false);
    void sendMessage();
  }

  const active = chats.find((chat) => chat.id === activeId);

  return (
    <div className="h-screen bg-desk p-0 lg:p-2.5">
      <div className="relative grid h-full overflow-hidden bg-white max-lg:grid-cols-[minmax(0,1fr)] max-lg:grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[288px_minmax(440px,1.1fr)_minmax(360px,560px)] lg:rounded-2xl lg:border lg:border-line lg:shadow-sm">
        <ChatList chats={chats} activeId={activeId} now={new Date()} isBusy={isBusy} isDrawerOpen={isDrawerOpen} hasListError={hasListError} hasCreateError={hasCreateError} newChatRef={newChatRef} onNewChat={startNewChat} onOpen={openChat} />
        <ChatPane title={active?.title ?? "แชตใหม่"} messages={messages} text={text} stage={stage} isBusy={isBusy} isSending={isSending} sendError={sendError} openError={openError} menuRef={menuRef} actions={active && <ChatActions chat={active} isDisabled={isBusy} onRenamed={putOnTop} onDeleted={removeChat} />} onOpenDrawer={() => setIsDrawerOpen(true)} onTextChange={setText} onFillText={setText} onSend={requestSend} isHiddenOnMobile={isBillTab} />
        {isNoticeOpen && <AiNoticeDialog isSaving={isNoticeSaving} error={noticeError} onAccept={acceptNotice} onClose={() => !isNoticeSaving && setIsNoticeOpen(false)} />}
        {isDrawerOpen && <button type="button" aria-label="ปิดประวัติแชต" onClick={() => setIsDrawerOpen(false)} className="absolute inset-0 z-40 bg-black/40 lg:hidden" />}
        <BillPreview bill={bill} hasError={hasBillError} className={isBillTab ? "" : "max-lg:hidden"} />
        <nav aria-label="สลับมุมมอง" className="grid grid-cols-2 border-t border-line bg-white lg:hidden">
          {[{ label: "แชต", isBill: false }, { label: "บิล", isBill: true }].map(({ label, isBill }) => (
            <button key={label} type="button" aria-pressed={isBillTab === isBill} onClick={() => setIsBillTab(isBill)} className="min-h-11 font-semibold text-ink-2 aria-pressed:text-ink aria-pressed:shadow-[inset_0_-2px_0_var(--color-ink)]">
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
