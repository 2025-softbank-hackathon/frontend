import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ConnectionBadge from './ConnectionBadge';
import MessageInput from './MessageInput';
import MessageList from './MessageList';
import useBootstrap from '../hooks/useBootstrap';
import useChat, { CONNECTION_STATUS } from '../hooks/useChat';
import { validText } from '../utils/validators';

const OPTIMISTIC_MATCH_THRESHOLD = 3000;

const toNumber = (value) => {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const getMessageId = (payload) => {
  if (!payload) {
    return '';
  }
  if (payload.messageId) {
    return payload.messageId;
  }
  if (payload.pk) {
    return payload.pk;
  }
  if (payload.id) {
    return payload.id;
  }
  const timestamp = toNumber(payload.timestamp);
  const nickname = payload.nickname || 'guest';
  const message = payload.message || '';
  return `${nickname}-${timestamp}-${message}`;
};

const normalizeServerMessage = (payload) => {
  if (!payload) {
    return null;
  }

  const timestamp = toNumber(payload.timestamp);
  const text = typeof payload.message === 'string' ? payload.message : '';
  const nickname = typeof payload.nickname === 'string' ? payload.nickname : 'Guest';
  const id = getMessageId(payload);

  return {
    id,
    messageId: payload.messageId || null,
    pk: payload.pk || null,
    nickname,
    message: text,
    timestamp,
    ttl: payload.ttl,
    pending: false,
    error: false,
  };
};

const sortByTimestamp = (list) =>
  [...list].sort((a, b) => {
    if (a.timestamp === b.timestamp) {
      return 0;
    }
    return a.timestamp < b.timestamp ? -1 : 1;
  });

const extractErrorMessage = (error) => {
  if (!error) {
    return '';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error.message && typeof error.message === 'string') {
    return error.message;
  }
  if (error.response?.data) {
    const data = error.response.data;
    if (typeof data === 'string') {
      return data;
    }
    if (typeof data?.message === 'string') {
      return data.message;
    }
    if (typeof data?.error === 'string') {
      return data.error;
    }
  }
  if (error.details?.message && typeof error.details.message === 'string') {
    return error.details.message;
  }
  if (typeof error.toString === 'function') {
    return error.toString();
  }
  return '';
};

const isRateLimitError = (error, message) => {
  if (!message) {
    return false;
  }
  const pattern = /429|rate|limit|too many|minute/i;
  if (pattern.test(message)) {
    return true;
  }
  if (error?.response?.status === 429) {
    return true;
  }
  const detailMessage = error?.details?.message;
  if (typeof detailMessage === 'string' && pattern.test(detailMessage)) {
    return true;
  }
  return false;
};

export default function ChatRoom() {
  const { nickname, initialMessages, loading, error, retry } = useBootstrap();
  const [messages, setMessages] = useState([]);
  const [badgeMessage, setBadgeMessage] = useState('');
  const [toast, setToast] = useState(null);

  const seenMessageIdsRef = useRef(new Set());
  const toastTimerRef = useRef(null);
  const rateLimitTimerRef = useRef(null);

  const showToast = useCallback((text) => {
    if (!text) {
      return;
    }
    setToast({ id: Date.now(), message: text });
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    if (rateLimitTimerRef.current) {
      clearTimeout(rateLimitTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4000);

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [toast]);

  useEffect(() => {
    const normalized = Array.isArray(initialMessages)
      ? initialMessages.map(normalizeServerMessage).filter(Boolean)
      : [];
    const sorted = sortByTimestamp(normalized);
    setMessages(sorted);
    const nextSeen = new Set();
    sorted.forEach((msg) => {
      if (msg.id) {
        nextSeen.add(msg.id);
      }
    });
    seenMessageIdsRef.current = nextSeen;
  }, [initialMessages]);

  useEffect(() => {
    if (!error) {
      return;
    }
    const message = extractErrorMessage(error) || '초기 데이터를 불러오지 못했습니다.';
    showToast(message);
  }, [error, showToast]);

  const showRateLimitNotice = useCallback(() => {
    setBadgeMessage('Slow down (10/min)');
    if (rateLimitTimerRef.current) {
      clearTimeout(rateLimitTimerRef.current);
    }
    rateLimitTimerRef.current = window.setTimeout(() => {
      setBadgeMessage('');
      rateLimitTimerRef.current = null;
    }, 3000);
  }, []);

  const handleChatError = useCallback(
    (incomingError) => {
      const message = extractErrorMessage(incomingError) || '문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
      if (isRateLimitError(incomingError, message)) {
        showRateLimitNotice();
        showToast('1분에 10개 제한');
        return;
      }
      showToast(message);
    },
    [showRateLimitNotice, showToast],
  );

  const handleStatusChange = useCallback((nextStatus) => {
    if (nextStatus === CONNECTION_STATUS.CONNECTED) {
      if (rateLimitTimerRef.current) {
        clearTimeout(rateLimitTimerRef.current);
        rateLimitTimerRef.current = null;
      }
      setBadgeMessage('');
    }
  }, []);

  const handleIncomingMessage = useCallback((payload) => {
    const normalized = normalizeServerMessage(payload);
    if (!normalized) {
      return;
    }
    const serverId = normalized.id;

    setMessages((prevMessages) => {
      let nextMessages = prevMessages;

      if (serverId) {
        const existingIndex = prevMessages.findIndex(
          (msg) =>
            msg.id === serverId ||
            msg.messageId === serverId ||
            msg.pk === serverId,
        );
        if (existingIndex !== -1) {
          nextMessages = [...prevMessages];
          nextMessages[existingIndex] = normalized;
          if (normalized.id) {
            seenMessageIdsRef.current.add(normalized.id);
          }
          return sortByTimestamp(nextMessages);
        }
      }

      const optimisticIndex = prevMessages.findIndex((msg) => {
        if (!msg.pending) {
          return false;
        }
        const diff = Math.abs(normalized.timestamp - msg.timestamp);
        return (
          msg.nickname === normalized.nickname &&
          msg.message === normalized.message &&
          diff <= OPTIMISTIC_MATCH_THRESHOLD
        );
      });

      if (optimisticIndex !== -1) {
        nextMessages = [...prevMessages];
        nextMessages[optimisticIndex] = normalized;
        if (normalized.id) {
          seenMessageIdsRef.current.add(normalized.id);
        }
        return sortByTimestamp(nextMessages);
      }

      if (serverId && seenMessageIdsRef.current.has(serverId)) {
        return prevMessages;
      }

      if (serverId) {
        seenMessageIdsRef.current.add(serverId);
      }

      nextMessages = [...prevMessages, normalized];
      return sortByTimestamp(nextMessages);
    });
  }, []);

  const { status, publish } = useChat({
    nickname,
    onMessage: handleIncomingMessage,
    onStatusChange: handleStatusChange,
    onError: handleChatError,
  });

  const handleSendMessage = useCallback(
    (text) => {
      if (!nickname) {
        return false;
      }
      if (!validText(text)) {
        return false;
      }

      const trimmed = text.trim();
      const optimisticId = uuidv4();
      const timestamp = Date.now();

      const optimisticMessage = {
        id: optimisticId,
        optimisticId,
        nickname,
        message: trimmed,
        timestamp,
        pending: true,
        error: false,
      };

      setMessages((prev) => sortByTimestamp([...prev, optimisticMessage]));

      const success = publish(trimmed);
      if (!success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticId ? { ...msg, pending: false, error: true } : msg,
          ),
        );
        showToast('메시지를 전송할 수 없습니다. 다시 시도해주세요.');
        return false;
      }

      return true;
    },
    [nickname, publish, showToast],
  );

  const connectionNotice = useMemo(() => {
    if (loading) {
      return '채팅 정보를 불러오는 중입니다…';
    }
    if (!nickname) {
      return '닉네임을 발급받는 중입니다…';
    }
    if (status === CONNECTION_STATUS.RECONNECTING) {
      return '연결이 끊어졌습니다. 재연결을 시도하는 중입니다…';
    }
    if (status === CONNECTION_STATUS.CONNECTING) {
      return '채팅 서버에 연결 중입니다…';
    }
    if (status === CONNECTION_STATUS.DISCONNECTED && nickname) {
      return '채팅 서버에 연결되어 있지 않습니다.';
    }
    return null;
  }, [loading, nickname, status]);

  const isInputDisabled = !nickname || status !== CONNECTION_STATUS.CONNECTED;

  const latestMessagePreview = useMemo(() => {
    if (!messages.length) {
      return null;
    }
    const latest = messages[messages.length - 1];
    if (!latest || typeof latest.message !== 'string') {
      return null;
    }
    const trimmed = latest.message.trim();
    if (!trimmed) {
      return null;
    }
    const nicknameLabel = typeof latest.nickname === 'string' && latest.nickname.trim()
      ? latest.nickname.trim()
      : 'Guest';
    const limit = 80;
    const text = trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed;
    return {
      nickname: nicknameLabel,
      text,
      fullText: trimmed,
    };
  }, [messages]);

  return (
    <div className="chat-room" aria-live="polite">
      <header className="chat-header">
        <div className="chat-header__info">
          <h1 className="chat-title">Chatting Service</h1>
          {nickname && <span className="chat-nickname">{nickname}</span>}
        </div>
        <ConnectionBadge status={status} message={badgeMessage} />
      </header>

      {error && (
        <div className="chat-error-banner" role="alert">
          <span>초기 데이터를 불러오는 데 실패했습니다.</span>
          <button type="button" onClick={retry} className="chat-error-retry">
            다시 시도
          </button>
        </div>
      )}

      {connectionNotice && <div className="connection-notice">{connectionNotice}</div>}

      <MessageList messages={messages} currentUser={nickname} />
      {latestMessagePreview && (
        <div className="message-preview">
          <span className="message-preview-label">최근 메시지</span>
          <span className="message-preview-author">{latestMessagePreview.nickname}</span>
          <span className="message-preview-text" title={latestMessagePreview.fullText}>
            {latestMessagePreview.text}
          </span>
        </div>
      )}
      <MessageInput disabled={isInputDisabled} onSend={handleSendMessage} />

      {toast && (
        <div className="chat-toast" role="status" aria-live="assertive">
          {toast.message}
        </div>
      )}
    </div>
  );
}

