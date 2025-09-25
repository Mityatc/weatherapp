import React, { useState, useRef, useEffect } from 'react';
import { useWeatherStream } from '../../hooks/useWeatherStream';
import type { Message } from '../../types/chat';

/**
 * ChatUI
 * Stateless chat surface binding input, message list, and stream formatting.
 * Includes minimal validation to ensure a location is present in queries.
 */
const ChatUI: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const { isLoading, error, send, cancel, setError } = useWeatherStream();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem('chat_messages');
      if (cached) setMessages(JSON.parse(cached));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('chat_messages', JSON.stringify(messages)); } catch {} }, [messages]);

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    const hasLocationHint = /(\b(in|at|for|city)\s+[A-Za-zÀ-ÿ'().-]{2,})/i.test(text);
    const looksLikeSingleLocation = /^[A-Za-zÀ-ÿ'().-]{2,}(?:\s+[A-Za-zÀ-ÿ'().-]{2,}){0,2}$/i.test(text);
    // Allow multiple comma-separated locations like "Mumbai now, Delhi tomorrow"
    const segments = text.split(',').map(s => s.trim());
    const segmentHasLocation = segments.some(seg => /(\b(in|at|for|city)\s+[A-Za-zÀ-ÿ'().-]{2,})/i.test(seg) || /^[A-Za-zÀ-ÿ'().-]{2,}(?:\s+[A-Za-zÀ-ÿ'().-]{2,}){0,2}$/i.test(seg));
    if (!(hasLocationHint || looksLikeSingleLocation || segmentHasLocation)) {
      setError('Please ask a weather question with a location (e.g., “Weather in London?” or just “Mumbai”).');
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), type: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    let assistantBuffer = '';
    const assistantId = `${Date.now()}-a`;
    setMessages(prev => [...prev, { id: assistantId, type: 'agent', content: '' }]);

    await send(text, (chunk) => {
      assistantBuffer += chunk;
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantBuffer } : m));
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  /** Render agent text with light structure parsing for readability. */
  const formatAgentMessage = (content: string) => {
    // Normalize spacing and newlines
    const normalized = content.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n');
    const lines = normalized.split('\n');

    // Try to detect structured multi-city sections like:
    // "Mumbai Now: ..." or "- Delhi Tomorrow: ..." followed by bullets
    type Section = { title: string; rows: string[] };
    const sections: Section[] = [];
    let current: Section | null = null;
    const titleRe = /^-?\s*([A-Za-z .()]+?)(?:\s*[—-]\s*|\s*:\s*)(.*)$/; // City — Label: text

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(titleRe);
      if (m) {
        if (current) sections.push(current);
        const initialRow = m[2] ? [m[2]] : [];
        current = { title: m[1].replace(/\s+/g, ' ').trim(), rows: initialRow };
        continue;
      }
      if (current) {
        // Bullet like "- Temperature: ..." or plain sentence row
        const isBullet = /^-\s+/.test(line);
        current.rows.push(isBullet ? line.replace(/^-\s+/, '') : line);
      }
    }
    if (current) sections.push(current);

    const renderInlineBold = (text: string) => text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>);

    const emphasizeLabel = (row: string) => {
      const m = row.match(/^\s*([A-Za-z ()]+?):\s*(.*)$/);
      if (!m) return row;
      const [, label, rest] = m;
      return (
        <>
          <strong className="text-gray-900">{label}:</strong> <span>{rest}</span>
        </>
      );
    };

    if (sections.length > 0) {
      return (
        <div className="space-y-4">
          {sections.map((sec, idx) => (
            <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="font-semibold text-gray-900 mb-2">{sec.title}</div>
              <ul className="list-disc pl-5 space-y-1 text-gray-800">
                {sec.rows
                  .map(r => r.replace(/\\n/g, ' ').trim())
                  .filter(Boolean)
                  .map((r, i2) => (
                    <li key={i2} className="leading-relaxed">
                      {typeof emphasizeLabel(r) === 'string' ? renderInlineBold(r as unknown as string) : emphasizeLabel(r as unknown as string)}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      );
    }

    // Fallback to minimal markdown-like rendering
    const elements: React.ReactNode[] = [];
    let listBuffer: React.ReactNode[] = [];
    const flushList = () => { if (listBuffer.length) { elements.push(<ul key={`ul-${elements.length}`} className="list-disc pl-6 space-y-1 text-gray-800">{listBuffer}</ul>); listBuffer = []; } };
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) { flushList(); return; }
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) { flushList(); elements.push(<h2 key={`h2-${index}`} className="font-bold text-gray-900 mb-4">{trimmed.slice(2, -2)}</h2>); return; }
      if (/^[a-z]\./i.test(trimmed)) { flushList(); const [letter, rest] = [trimmed.slice(0, 2), trimmed.slice(2).trim()]; elements.push(<div key={`letter-${index}`} className="pl-6 text-gray-800"><span className="font-medium text-gray-900 mr-1">{letter}</span><span>{renderInlineBold(rest)}</span></div>); return; }
      if (trimmed.startsWith('- ')) { const itemText = trimmed.slice(2); listBuffer.push(<li key={`li-${index}`}>{renderInlineBold(itemText)}</li>); return; }
      flushList(); elements.push(<p key={`p-${index}`} className="text-gray-800 leading-relaxed">{renderInlineBold(line)}</p>);
    });
    flushList();
    return elements;
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.type === 'user' ? (
                <div className="bg-gray-200 text-gray-900 rounded-2xl px-5 py-3 max-w-[680px] shadow-sm">
                  <p className="text-base leading-relaxed">{message.content}</p>
                </div>
              ) : (
                <div className="text-gray-900 max-w-[680px]">
                  <div className="space-y-3">{formatAgentMessage(message.content)}</div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-gray-200 bg-white px-4 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sticky bottom-0">
        <div className="max-w-3xl mx-auto">
          <div className="relative h-12" role="group" aria-label="Message input">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              maxLength={1000}
              aria-label="Type your weather question"
              className="w-full h-12 rounded-2xl border border-gray-300 bg-white px-4 pr-32 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/70 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => { cancel(); setMessages([]); setError(null); localStorage.removeItem('chat_messages'); }}
              className="absolute right-14 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-10 w-10 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black/10"
              title="Clear chat"
              aria-label="Clear chat"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
            <button
              onClick={handleSendMessage}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-10 w-10 rounded-xl bg-black text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black/60"
              aria-label="Send"
            >
              <svg className="w-5 h-5 transform rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l9 2-9-18-9 18 9-2z" />
                <path d="M12 19v-8" />
              </svg>
            </button>
            <div className="pointer-events-none absolute right-28 top-1/2 -translate-y-1/2 text-xs text-gray-400 select-none">
              {inputValue.length}/1000
            </div>
          </div>
          {error && (
            <div className="mt-2 text-sm text-red-600 flex items-center space-x-3">
              <span>{error}</span>
              <button type="button" onClick={() => { setError(null); handleSendMessage(); }} className="text-red-700 underline decoration-dotted hover:decoration-solid">Retry</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatUI;


