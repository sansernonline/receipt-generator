"use client";

import { useEffect, useRef, useState } from "react";
import { AiNoticeDialog } from "./ai-notice-dialog";
import { ChatActions } from "./chat-actions";
import { ChatList } from "./chat-list";
import { acknowledgeAiNotice, hasAcknowledgedAiNotice } from "../consent/ai-notice-flag";
import { BillPreview } from "../bill/bill-preview";
import { fetchBill, parseBill } from "../bill/fetch-bill";
import type { BillData } from "../bill/types";
import type { SendMessageResponse } from "../draft/types";
import { accentFromFile } from "../shop-header/accent-color";
import { ShopCard } from "../shop-header/shop-card";
import type { ShopProposal } from "../shop-header/types";
import { attachProblem } from "../uploads/attach-problem";
import { ChatPane, type ChatMessage } from "./chat-pane";
import type { ChatListItem } from "./group-chats";
import { AiWaitTimeout, postMessage, postPicture } from "./post-message";
import { stageOf, type ChatStage } from "./quick-chips";

const SEND_FAILED = "ส่งข้อความไม่สำเร็จ ลองอีกครั้ง";
// the draft may have changed on the server by now, so this text must not say it is unchanged (mockup #s-err-ai says so only for the server's own "AI unreachable" notice)
const AI_TIMED_OUT = "ยังไม่ได้รับคำตอบจาก AI ตรวจร่างบิลก่อนสั่งต่อ แล้วลองส่งอีกครั้งได้";
const CONSENT_SAVE_LIMIT_MS = 10_000; // a hung request must not keep the notice locked: cancel and accept are off while saving
const NOTICE_SAVE_FAILED = "บันทึกการรับทราบไม่สำเร็จ ลองอีกครั้ง";
const UNDONE = "ย้อนกลับแล้ว";
const UNDO_FAILED = "ย้อนกลับไม่สำเร็จ ลองอีกครั้ง";
const PICTURE_SENT = "ส่งรูปบิลตัวอย่าง"; // what the server stores for the turn (send-shop-image.ts)
const SHOP_USED = "ใช้หัวบิลนี้แล้ว พิมพ์รายการสินค้าต่อได้เลย";

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
  // the AI proposal waiting for the user, with the typed text to send again after the shop is set (when it held items too); not stored, so both are gone when the chat is closed
  const [shopCard, setShopCard] = useState<{ fields: ShopProposal; followUp: string | null; ticket: number; sample?: string } | null>(null); // ticket = which open chat the card belongs to; sample = object URL of the picture the card was read from
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoNote, setUndoNote] = useState(""); // said aloud to screen readers by the bill preview
  const [hasBillError, setHasBillError] = useState(false);
  const [isBillTab, setIsBillTab] = useState(false); // phone only: one of chat / bill fills the screen
  const newChatRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const wasDrawerOpen = useRef(false);
  const pendingPicture = useRef<File | null>(null); // held back until the user has seen the AI notice
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

  // the picture's object URL is let go when the card is replaced or closed
  const sample = shopCard?.sample;
  useEffect(() => () => (sample ? URL.revokeObjectURL(sample) : undefined), [sample]);

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
    setIsUndoing(false);
    setUndoNote("");
    setShopCard(null);
    setHasBillError(false);
    setIsDrawerOpen(false);
  }

  function removeChat(id: string) {
    setChats((current) => current.filter((chat) => chat.id !== id));
    showChat(null, []); // the deleted chat was the open one; sending a message now starts a new chat
  }

  // null = the user opened another chat while this one was being made: it only joins the list, the screen stays where the user is
  async function createChat(): Promise<string | null> {
    const ticket = latestOpen.current;
    const res = await fetch("/api/chats", { method: "POST" });
    if (!res.ok) throw new Error("create failed");
    const { chat } = await res.json();
    putOnTop(chat);
    if (ticket !== latestOpen.current) return null;
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

  // the server puts the draft back one edit and answers with the bill it now has (FR-ITEM-120)
  // one undo at a time: a second press while the first waits would take back a second edit
  async function undoEdit() {
    if (!activeId || isUndoing) return;
    const ticket = latestOpen.current;
    setIsUndoing(true);
    setUndoNote("");
    const res = await fetch(`/api/chats/${activeId}/undo`, { method: "POST" }).catch(() => null);
    const undone = res?.ok ? parseBill(await res.json().catch(() => null)) : null;
    if (ticket === latestOpen.current) {
      if (undone) {
        setBill(undone);
        setStage(undone.draft.items.length ? "has-items" : "no-items");
        setUndoNote(UNDONE);
      } else setSendError(UNDO_FAILED);
    }
    setIsUndoing(false);
  }

  // the server's answer to a message or a picture; a new card replaces the old one, an answer with no shop info keeps it
  function showAnswer(answer: SendMessageResponse, shown: ChatMessage[], ticket: number, sentText: string | null, sample?: string) {
    putOnTop(answer.chat); // the reply is stored on the server; opening that chat again shows it
    if (ticket !== latestOpen.current) return;
    setMessages([...shown, ...answer.messages, ...answer.notices.map((notice) => ({ role: "notice", text: notice }))]);
    setBill((current) => parseBill(answer) ?? current);
    setShopCard((current) => (answer.shop ? null : answer.shopCard ? { fields: answer.shopCard, followUp: answer.shopCardHasBill ? sentText : null, ticket, sample } : current));
  }

  // the box is cleared and the user's bubble shows at once; if sending fails both are put back
  async function sendMessage(again?: string) {
    const sentText = again ?? text;
    const shown = activeId ? messages : [];
    setIsBusy(true);
    setIsSending(true);
    setSendError(null);
    let ticket = latestOpen.current;
    try {
      const chatId = activeId ?? (await createChat());
      if (chatId === null) return; // the user left for another chat; the empty new chat stays in the list
      ticket = latestOpen.current;
      setMessages([...shown, { role: "user", text: sentText }]);
      if (again === undefined) setText(""); // a text sent again by itself must not wipe what the user has started to type
      showAnswer(await postMessage(chatId, sentText), shown, ticket, sentText);
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

  // a sample bill picture: the browser finds its main colour, the server reads the header (FR-HDR-020 · 040); on failure the bubble is taken back
  async function sendPicture(file: File) {
    const shown = activeId ? messages : [];
    setIsBusy(true);
    setIsSending(true);
    setSendError(null);
    let ticket = latestOpen.current;
    try {
      const chatId = activeId ?? (await createChat());
      if (chatId === null) return;
      ticket = latestOpen.current;
      setMessages([...shown, { role: "user", text: PICTURE_SENT }]);
      const answer = await postPicture(chatId, file, await accentFromFile(file));
      showAnswer(answer, shown, ticket, null, answer.shopCard ? URL.createObjectURL(file) : undefined);
    } catch (error) {
      if (ticket !== latestOpen.current) return;
      setMessages(shown);
      setSendError(error instanceof AiWaitTimeout ? AI_TIMED_OUT : SEND_FAILED);
    } finally {
      setIsSending(false);
      setIsBusy(false);
    }
  }

  async function attachPicture(file: File) {
    const problem = await attachProblem(file);
    if (problem) return setMessages((current) => [...current, { role: "notice", text: problem }]);
    if (hasAcknowledgedAiNotice()) return void sendPicture(file);
    pendingPicture.current = file;
    setNoticeError(null);
    setIsNoticeOpen(true);
  }

  function showShopUsed(shopBill: BillData, followUp: string | null, ticket: number) {
    if (ticket !== latestOpen.current) return; // the user went to another chat while the shop was being saved: that chat shows its shop when opened again
    setBill(shopBill);
    setShopCard(null);
    setStage(shopBill.draft.items.length ? "has-items" : "no-items");
    setMessages((current) => [...current, { role: "assistant", text: SHOP_USED }]);
    if (followUp) void sendMessage(followUp); // the AI notice was accepted before the first message, so this one may go too
  }

  // nothing leaves this machine for the AI before the user has seen the notice (NFR-PDPA-030)
  function requestSend() {
    if (hasAcknowledgedAiNotice()) void sendMessage();
    else {
      setNoticeError(null);
      setIsNoticeOpen(true);
    }
  }

  function closeNotice() {
    if (isNoticeSaving) return;
    pendingPicture.current = null;
    setIsNoticeOpen(false);
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
    const picture = pendingPicture.current;
    pendingPicture.current = null;
    void (picture ? sendPicture(picture) : sendMessage());
  }

  const active = chats.find((chat) => chat.id === activeId);

  return (
    <div className="h-screen bg-desk p-0 lg:p-2.5">
      <div className="relative grid h-full overflow-hidden bg-white max-lg:grid-cols-[minmax(0,1fr)] max-lg:grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[288px_minmax(440px,1.1fr)_minmax(360px,560px)] lg:rounded-2xl lg:border lg:border-line lg:shadow-sm">
        <ChatList chats={chats} activeId={activeId} now={new Date()} isBusy={isBusy} isDrawerOpen={isDrawerOpen} hasListError={hasListError} hasCreateError={hasCreateError} newChatRef={newChatRef} onNewChat={startNewChat} onOpen={openChat} />
        <ChatPane title={active?.title ?? "แชตใหม่"} messages={messages} text={text} stage={stage} isBusy={isBusy} isSending={isSending} sendError={sendError} openError={openError} menuRef={menuRef} actions={active && <ChatActions chat={active} isDisabled={isBusy} onRenamed={putOnTop} onDeleted={removeChat} />} card={shopCard && activeId && <ShopCard key={JSON.stringify(shopCard)} card={shopCard.fields} sample={shopCard.sample} hasFollowUp={shopCard.followUp !== null} chatId={activeId} onUsed={(shopBill) => showShopUsed(shopBill, shopCard.followUp, shopCard.ticket)} />} onOpenDrawer={() => setIsDrawerOpen(true)} onTextChange={setText} onFillText={setText} onSend={requestSend} canAttach={stage === "no-shop" && !isBusy} onAttach={(file) => void attachPicture(file)} isHiddenOnMobile={isBillTab} />
        {isNoticeOpen && <AiNoticeDialog isSaving={isNoticeSaving} error={noticeError} onAccept={acceptNotice} onClose={closeNotice} />}
        {isDrawerOpen && <button type="button" aria-label="ปิดประวัติแชต" onClick={() => setIsDrawerOpen(false)} className="absolute inset-0 z-40 bg-black/40 lg:hidden" />}
        <BillPreview bill={bill} hasError={hasBillError} isUndoBlocked={isBusy || isUndoing} undoNote={undoNote} onUndo={() => void undoEdit()} className={isBillTab ? "" : "max-lg:hidden"} />
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
