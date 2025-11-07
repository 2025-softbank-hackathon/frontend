import { useCallback, useEffect, useMemo, useState } from 'react';
import { historyApi, joinApi } from '../api/http';

const sortMessages = (messages) =>
  [...messages].sort((a, b) => {
    if (a.timestamp === b.timestamp) {
      return 0;
    }
    return a.timestamp < b.timestamp ? -1 : 1;
  });

export default function useBootstrap() {
  const [nickname, setNickname] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [joinResponse, historyResponse] = await Promise.all([joinApi(), historyApi()]);
      const nextNickname = joinResponse?.nickname || '';
      const historyMessages = Array.isArray(historyResponse) ? historyResponse : [];

      setNickname(nextNickname);
      setMessages(sortMessages(historyMessages));
    } catch (err) {
      setError(err);
      setNickname('');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const result = useMemo(
    () => ({
      nickname,
      initialMessages: messages,
      loading,
      error,
      retry: bootstrap,
    }),
    [bootstrap, error, loading, messages, nickname],
  );

  return result;
}

