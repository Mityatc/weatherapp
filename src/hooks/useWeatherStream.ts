import { useRef, useState, useCallback } from 'react';
import { sendMessageToWeatherAgent } from '../lib/api';

/**
 * useWeatherStream
 * Manages a single streaming request lifecycle to the weather agent.
 * Exposes loading state, last error, a send() to start streaming, and cancel().
 */
export function useWeatherStream() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Start a streaming request. onChunk will receive incremental text.
   * onComplete fires after the stream ends normally.
   */
  const send = useCallback(async (
    text: string,
    onChunk: (chunk: string) => void,
    onComplete?: () => void
  ) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError(null);

    await sendMessageToWeatherAgent(
      text,
      onChunk,
      (err) => {
        const friendly = typeof window !== 'undefined' && !navigator.onLine
          ? 'You are offline. Check your connection and try again.'
          : err === 'Failed to fetch'
            ? 'Network error. Please try again.'
            : err;
        setError(friendly);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
        onComplete?.();
      },
      controller
    );
  }, []);

  /** Cancel any in-flight request. */
  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return { isLoading, error, send, cancel, setError } as const;
}


