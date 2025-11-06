import { useCallback, useEffect, useRef, useState } from 'react';
import stompClientManager from '../api/stompClient';

export const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
};

const SUBSCRIPTION_DESTINATION = process.env.REACT_APP_STOMP_SUB;
const PUBLISH_DESTINATION = process.env.REACT_APP_STOMP_PUB;

export default function useStompClient({ enabled, onMessage }) {
  const [status, setStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const subscriptionCleanupRef = useRef(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) {
      setStatus(CONNECTION_STATUS.DISCONNECTED);
      return () => {};
    }

    setStatus(CONNECTION_STATUS.CONNECTING);

    const unsubscribe = SUBSCRIPTION_DESTINATION
      ? stompClientManager.subscribe(SUBSCRIPTION_DESTINATION, (payload) => {
          if (payload && typeof onMessageRef.current === 'function') {
            onMessageRef.current(payload);
          }
        })
      : null;

    subscriptionCleanupRef.current = unsubscribe;

    stompClientManager.connect({
      onConnect: () => {
        setStatus(CONNECTION_STATUS.CONNECTED);
      },
      onDisconnect: () => {
        setStatus((prev) =>
          prev === CONNECTION_STATUS.DISCONNECTED
            ? CONNECTION_STATUS.DISCONNECTED
            : CONNECTION_STATUS.RECONNECTING,
        );
      },
      onReconnecting: () => {
        setStatus(CONNECTION_STATUS.RECONNECTING);
      },
      onError: () => {
        setStatus(CONNECTION_STATUS.RECONNECTING);
      },
    });

    return () => {
      if (typeof subscriptionCleanupRef.current === 'function') {
        subscriptionCleanupRef.current();
        subscriptionCleanupRef.current = null;
      }
      stompClientManager.disconnect();
      setStatus(CONNECTION_STATUS.DISCONNECTED);
    };
  }, [enabled]);

  const sendMessage = useCallback(
    (body) => {
      if (status !== CONNECTION_STATUS.CONNECTED) {
        return false;
      }
      if (!PUBLISH_DESTINATION) {
        console.warn('Publish destination is not defined. Check REACT_APP_STOMP_PUB.');
        return false;
      }
      try {
        stompClientManager.publish(PUBLISH_DESTINATION, body);
        return true;
      } catch (error) {
        console.error('Failed to send message via STOMP', error);
        return false;
      }
    },
    [status],
  );

  return {
    status,
    isConnected: status === CONNECTION_STATUS.CONNECTED,
    sendMessage,
  };
}

