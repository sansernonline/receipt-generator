import type { ChatMessage } from "./chat-pane";

const bubble = "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2";

// "notice" is a Thai text from the server (warnings, AI failure); it is not saved in the chat history
export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") return <p className={`${bubble} self-end bg-accent-fill text-white`}>{message.text}</p>;
  if (message.role === "notice") {
    return (
      <p role="alert" className={`${bubble} self-start border-l-4 border-accent bg-surface-2`}>
        {message.text}
      </p>
    );
  }
  return <p className={`${bubble} self-start bg-surface-2`}>{message.text}</p>;
}
