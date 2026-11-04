import { ChatList } from "./chat-list";
import { ChatPane } from "./chat-pane";

export function ChatShell() {
  return (
    <div className="h-screen bg-desk p-0 lg:p-2.5">
      <div className="grid h-full overflow-hidden bg-white lg:grid-cols-[288px_minmax(440px,1.1fr)_minmax(360px,560px)] lg:rounded-2xl lg:border lg:border-line lg:shadow-sm">
        <ChatList />
        <ChatPane />
        <section aria-label="ตัวอย่างบิล" className="hidden items-center justify-center border-l border-line bg-desk text-sm text-ink-3 lg:flex">
          ตัวอย่างบิลจะแสดงที่นี่
        </section>
      </div>
    </div>
  );
}
