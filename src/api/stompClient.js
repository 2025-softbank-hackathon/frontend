import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WS_URL = process.env.REACT_APP_WS_URL;
const BASE_DELAY = 1000;
const MAX_DELAY = 16000;

const ensureString = (value) => {
  if (typeof value === 'string') {
    return value;
  }
  if (!value) {
    return '';
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
};

const parseErrorBody = (body) => {
  if (!body) {
    return null;
  }
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed;
    } catch (error) {
      return body;
    }
  }
  return body;
};

const createErrorPayload = ({ type, message, details }) => ({
  type,
  message: message || '알 수 없는 오류가 발생했습니다.',
  details,
});

const normalizeStompError = (frame) => {
  const parsedBody = parseErrorBody(frame?.body);
  const messageFromBody =
    typeof parsedBody === 'string'
      ? parsedBody
      : ensureString(parsedBody?.message || parsedBody?.error);
  const message = messageFromBody || frame?.headers?.message || 'STOMP error';
  return createErrorPayload({
    type: 'stomp',
    message,
    details: frame,
  });
};

const normalizeWebSocketError = (event) => {
  const message = ensureString(event?.reason || event?.message || event);
  return createErrorPayload({
    type: 'websocket',
    message: message || 'WebSocket error',
    details: event,
  });
};

class StompClientManager {
  constructor() {
    this.client = null;
    this.subscriptions = new Map();
    this.activeSubscriptions = new Map();
    this.callbacks = {
      onConnect: null,
      onDisconnect: null,
      onReconnecting: null,
      onError: null,
    };
    this.reconnectTimeout = null;
    this.currentDelay = BASE_DELAY;
    this.shouldReconnect = false;
    this.subscriptionIndex = 0;
  }

  connect(callbacks = {}) {
    this.callbacks = {
      onConnect: callbacks.onConnect || null,
      onDisconnect: callbacks.onDisconnect || null,
      onReconnecting: callbacks.onReconnecting || null,
      onError: callbacks.onError || null,
    };

    if (!WS_URL) {
      console.warn('WebSocket URL is not defined. Check REACT_APP_WS_URL in your environment.');
      return;
    }

    this.shouldReconnect = true;
    this.clearReconnectTimeout();
    this.currentDelay = BASE_DELAY;
    this._activateClient();
  }

  disconnect() {
    this.shouldReconnect = false;
    this.clearReconnectTimeout();
    this.activeSubscriptions.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch (error) {
        console.debug('Error unsubscribing on disconnect', error);
      }
    });
    this.activeSubscriptions.clear();

    if (this.client) {
      const toDeactivate = this.client;
      this.client = null;
      try {
        toDeactivate.deactivate();
      } catch (error) {
        console.debug('Error while deactivating STOMP client', error);
      }
    }
  }

  subscribe(destination, callback, headers = {}) {
    if (!destination || typeof callback !== 'function') {
      console.warn('subscribe requires a destination and a callback function');
      return () => {};
    }

    const id = `sub-${Date.now()}-${++this.subscriptionIndex}`;
    const wrappedCallback = (message) => {
      try {
        const body = message.body ? JSON.parse(message.body) : null;
        callback(body, message);
      } catch (error) {
        console.error('Failed to parse STOMP message body', error);
      }
    };

    this.subscriptions.set(id, {
      destination,
      callback: wrappedCallback,
      headers,
    });

    this._ensureSubscribed(id);

    return () => this.unsubscribe(id);
  }

  unsubscribe(id) {
    const active = this.activeSubscriptions.get(id);
    if (active) {
      try {
        active.unsubscribe();
      } catch (error) {
        console.debug('Error while unsubscribing', error);
      }
      this.activeSubscriptions.delete(id);
    }
    this.subscriptions.delete(id);
  }

  publish(destination, body = {}) {
    if (!this.client || !this.client.connected) {
      throw new Error('STOMP client is not connected.');
    }

    const payload = typeof body === 'string' ? body : JSON.stringify(body);

    this.client.publish({
      destination,
      body: payload,
    });
  }

  clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  _activateClient() {
    if (this.client) {
      try {
        this.client.deactivate();
      } catch (error) {
        console.debug('Error while deactivating existing client before re-activate', error);
      }
      this.client = null;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 0,
      debug: () => {},
    });

    client.onConnect = (frame) => {
      this.clearReconnectTimeout();
      this.currentDelay = BASE_DELAY;
      this._resubscribeAll(client);
      if (this.callbacks.onConnect) {
        this.callbacks.onConnect(frame);
      }
    };

    client.onStompError = (frame) => {
      if (this.callbacks.onError) {
        this.callbacks.onError(normalizeStompError(frame));
      }
      this._handleDisconnect();
    };

    client.onWebSocketError = (event) => {
      if (this.callbacks.onError) {
        this.callbacks.onError(normalizeWebSocketError(event));
      }
    };

    client.onWebSocketClose = (event) => {
      if (this.callbacks.onDisconnect) {
        this.callbacks.onDisconnect(event);
      }
      this._handleDisconnect();
    };

    this.client = client;
    client.activate();
  }

  _handleDisconnect() {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.callbacks.onReconnecting) {
      this.callbacks.onReconnecting(this.currentDelay);
    }

    if (this.reconnectTimeout) {
      return;
    }

    const delay = this.currentDelay;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.shouldReconnect) {
        return;
      }
      this.currentDelay = Math.min(this.currentDelay * 2, MAX_DELAY);
      this._activateClient();
    }, delay);
  }

  _resubscribeAll(client) {
    this.activeSubscriptions.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch (error) {
        console.debug('Failed to clean up active subscription during resubscribe', error);
      }
    });
    this.activeSubscriptions.clear();

    this.subscriptions.forEach((subscription, id) => {
      const stompSubscription = client.subscribe(
        subscription.destination,
        subscription.callback,
        subscription.headers,
      );
      this.activeSubscriptions.set(id, stompSubscription);
    });
  }

  _ensureSubscribed(id) {
    if (!this.client || !this.client.connected) {
      return;
    }

    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      return;
    }

    const stompSubscription = this.client.subscribe(
      subscription.destination,
      subscription.callback,
      subscription.headers,
    );
    this.activeSubscriptions.set(id, stompSubscription);
  }
}

const stompClientManager = new StompClientManager();

export default stompClientManager;

