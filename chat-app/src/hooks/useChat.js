import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import stompClientManager from '../api/stompClient';
import { validText } from '../utils/validators';

export const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
};

const SUBSCRIPTION_DESTINATION = process.env.REACT_APP_STOMP_SUB;
const PUBLISH_DESTINATION = process.env.REACT_APP_STOMP_PUB;

const noop = () => {};

export default function useChat({ nickname, onMessage = noop, onStatusChange = noop, onError = noop }) {
  const [status, setStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  const onErrorRef = useRef(onError);
  const subscriptionCleanupRef = useRef(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const updateStatus = useCallback((nextStatus) => {
    setStatus(nextStatus);
    onStatusChangeRef.current(nextStatus);
  }, []);

  useEffect(() => {
    if (!nickname) {
      updateStatus(CONNECTION_STATUS.DISCONNECTED);
      if (typeof subscriptionCleanupRef.current === 'function') {
        subscriptionCleanupRef.current();
        subscriptionCleanupRef.current = null;
      }
      stompClientManager.disconnect();
      return undefined;
    }

    updateStatus(CONNECTION_STATUS.CONNECTING);

    const unsubscribe = SUBSCRIPTION_DESTINATION
      ? stompClientManager.subscribe(SUBSCRIPTION_DESTINATION, (payload, raw) => {
          if (!payload) {
            return;
          }
          onMessageRef.current(payload, raw);
        })
      : null;

    subscriptionCleanupRef.current = unsubscribe;

    stompClientManager.connect({
      onConnect: () => {
        updateStatus(CONNECTION_STATUS.CONNECTED);
      },
      onDisconnect: () => {
        updateStatus(CONNECTION_STATUS.RECONNECTING);
      },
      onReconnecting: () => {
        updateStatus(CONNECTION_STATUS.RECONNECTING);
      },
      onError: (error) => {
        onErrorRef.current(error);
        updateStatus(CONNECTION_STATUS.RECONNECTING);
      },
    });

    return () => {
      if (typeof subscriptionCleanupRef.current === 'function') {
        subscriptionCleanupRef.current();
        subscriptionCleanupRef.current = null;
      }
      stompClientManager.disconnect();
      updateStatus(CONNECTION_STATUS.DISCONNECTED);
    };
  }, [nickname, updateStatus]);

  const publish = useCallback(
    (text) => {
      if (!nickname) {
        return false;
      }

      if (!validText(text)) {
        onErrorRef.current('메시지는 1자 이상 500자 이하로 입력하세요.');
        return false;
      }

      if (!PUBLISH_DESTINATION) {
        onErrorRef.current('발행 엔드포인트가 설정되지 않았습니다.');
        return false;
      }

      const trimmed = text.trim();

      try {
        stompClientManager.publish(PUBLISH_DESTINATION, {
          nickname,
          message: trimmed,
        });
        return true;
      } catch (error) {
        onErrorRef.current(error);
        return false;
      }
    },
    [nickname],
  );

  return useMemo(
    () => ({
      status,
      publish,
    }),
    [publish, status],
  );
}

