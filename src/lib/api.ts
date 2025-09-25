export interface ApiMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface ApiRequest {
  messages: ApiMessage[];
  runId: string;
  maxRetries: number;
  maxSteps: number;
  temperature: number;
  topP: number;
  runtimeContext: Record<string, unknown>;
  threadId: string;
  resourceId: string;
}

const API_ENDPOINT = 'https://millions-screeching-vultur.mastra.cloud/api/agents/weatherAgent/stream';
const THREAD_ID = '22-COMPC18-26';

export const createApiRequest = (message: string): ApiRequest => ({
  messages: [
    {
      role: 'system',
      content:
        'You are a weather-only assistant. Answer strictly weather-related queries. If the message is not about weather or lacks a location, ask for a weather question with a location. Keep responses concise.'
    },
    { role: 'user', content: message }
  ],
  runId: 'weatherAgent',
  maxRetries: 2,
  maxSteps: 5,
  temperature: 0.5,
  topP: 1,
  runtimeContext: {},
  threadId: THREAD_ID,
  resourceId: 'weatherAgent'
});

export const extractTextFromTokenStream = (raw: string): string => {
  try {
    if (/^[faed]:/i.test(raw.trim())) return '';
    const tokens: string[] = [];
    const re = /\d+:"([\s\S]*?)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) tokens.push(m[1]);
    if (tokens.length > 0) return tokens.join('');
    const trimmed = raw.trimStart();
    if (/^\d+:/.test(trimmed)) {
      const afterIndex = trimmed.replace(/^\d+:/, '');
      const firstBrace = afterIndex.indexOf('{');
      const lastBrace = afterIndex.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return afterIndex.slice(lastBrace + 1).trim();
      }
      return '';
    }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj?.toolCallId || obj?.toolName || obj?.messageId || obj?.finishReason) return '';
      } catch {}
    }
    return raw;
  } catch {
    return raw;
  }
};

export const sendMessageToWeatherAgent = async (
  message: string,
  onChunk: (chunk: string) => void,
  onError: (error: string) => void,
  onComplete: () => void,
  abortController?: AbortController
): Promise<void> => {
  try {
    const requestBody = createApiRequest(message);
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json',
        'x-mastra-dev-playground': 'true'
      },
      body: JSON.stringify(requestBody),
      signal: abortController?.signal
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body reader available');
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') { onComplete(); return; }
          let cleaned = extractTextFromTokenStream(data);
          // Normalize escaped newlines from the stream
          cleaned = cleaned.replace(/\\n/g, '\n');
          if (cleaned) onChunk(cleaned);
        } else {
          let cleaned = extractTextFromTokenStream(line);
          cleaned = cleaned.replace(/\\n/g, '\n');
          if (cleaned) onChunk(cleaned);
        }
      }
    }
    onComplete();
  } catch (error) {
    if (error instanceof Error) {
      if ((error as any).name === 'AbortError') onError('Request cancelled');
      else onError(error.message);
    } else onError('An unknown error occurred');
  }
};


