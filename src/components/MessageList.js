import { useEffect, useRef } from 'react';
import MessageItem from './MessageItem';

const AUTO_SCROLL_THRESHOLD = 120;

export default function MessageList({ messages, currentUser }) {
  const listRef = useRef(null);
  const endRef = useRef(null);
  const initialScrollAppliedRef = useRef(false);
  const lastMessageKeyRef = useRef(null);

  const getMessageKey = (message) => {
    if (!message) {
      return null;
    }
    return (
      message.id ||
      message.messageId ||
      message.pk ||
      message.timestamp ||
      null
    );
  };

  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) {
      return;
    }

    const latestMessage = messages.length ? messages[messages.length - 1] : null;
    const latestKey = getMessageKey(latestMessage);
    const isLatestOwnMessage =
      latestMessage && latestMessage.nickname === currentUser;
    const isNewLatestMessage = latestKey && latestKey !== lastMessageKeyRef.current;

    if (!initialScrollAppliedRef.current) {
      if (!messages.length) {
        return;
      }
      initialScrollAppliedRef.current = true;
      window.requestAnimationFrame(() => {
        if (endRef.current) {
          endRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
        } else {
          listEl.scrollTop = listEl.scrollHeight;
        }
      });
      lastMessageKeyRef.current = latestKey || null;
      return;
    }

    const distanceFromBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight;
    const nearBottom = distanceFromBottom <= AUTO_SCROLL_THRESHOLD;
    const shouldAutoScroll = nearBottom || (isLatestOwnMessage && isNewLatestMessage);

    if (shouldAutoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else if (shouldAutoScroll) {
      listEl.scrollTop = listEl.scrollHeight;
    }

    if (latestKey || latestKey === 0) {
      lastMessageKeyRef.current = latestKey;
    } else if (!messages.length) {
      lastMessageKeyRef.current = null;
    }
  }, [messages, currentUser]);

  return (
    <div
      className="message-list"
      ref={listRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <ul className="message-list-inner">
        {messages.map((message, index) => {
          const key = getMessageKey(message) ?? `message-${index}`;
          return (
            <MessageItem
              key={key}
              message={message}
              isOwn={message.nickname === currentUser}
            />
          );
        })}
      </ul>
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}

