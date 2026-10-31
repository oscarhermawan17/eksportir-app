'use client';

import { CHAT_LIMITS } from '@balitrade/shared';
import type { ChatMessageView } from '@balitrade/shared';
import { Info, Send } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { FormErrors, inputClasses } from '@/components/ui/field';
import { apiFetch, errorKey } from '@/lib/api';
import { subscribeToConversation } from '@/lib/chat-socket';

/** Safety net next to the live socket: how often the newest messages are re-read while the tab is visible. */
const POLL_LIVE_MS = 30_000;
/** Without a live socket (connecting, blocked, server restarting) the panel polls this often instead. */
const POLL_FALLBACK_MS = 4000;

/** Adds `incoming` to `current`, drops duplicates and keeps the order by time. */
function merge(current: ChatMessageView[], incoming: ChatMessageView[]): ChatMessageView[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/**
 * One conversation: the messages and the composer. Mount it with `key={conversationId}` so switching
 * conversations starts from a clean state.
 */
export function ChatPanel({ conversationId }: { conversationId: string }) {
  const t = useTranslations('Chat');
  const tErrors = useTranslations('Errors');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessageView[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  /** Counts reconnects, so the polling effect re-reads right away to catch up on messages missed while offline. */
  const [reconnects, setReconnects] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  /** True while the reader is at the bottom, so new messages scroll into view without yanking an older read position. */
  const stickToBottom = useRef(true);
  /** Scroll height before older messages were added, to keep the reading position afterwards. */
  const heightBeforePrepend = useRef<number | null>(null);
  /** Live messages that arrive while the first page is still loading; merged in when it lands. */
  const pending = useRef<ChatMessageView[]>([]);

  const path = `/conversations/${encodeURIComponent(conversationId)}/messages`;

  useEffect(() => {
    let cancelled = false;
    apiFetch<ChatMessageView[]>(path)
      .then((page) => {
        if (cancelled) return;
        setMessages(merge(page, pending.current));
        pending.current = [];
        setHasMore(page.length >= CHAT_LIMITS.pageSize);
      })
      .catch((error: unknown) => {
        console.error('Could not load messages', error);
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  // Reading the conversation settles its notification: on opening, for every new message shown, and when the tab comes back.
  const shown = messages?.length ?? 0;
  useEffect(() => {
    if (shown === 0) return;
    const markRead = () => {
      if (document.hidden) return;
      apiFetch(`/notifications/conversations/${encodeURIComponent(conversationId)}/read`, { method: 'POST' }).catch(() => undefined);
    };
    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [shown, conversationId]);

  // Live messages arrive over the socket; the connection state decides how much polling is still needed.
  useEffect(
    () =>
      subscribeToConversation(conversationId, {
        onEvent: (message) => {
          setMessages((current) => {
            if (current === null) {
              pending.current.push(message);
              return current;
            }
            return merge(current, [message]);
          });
        },
        onStatus: (connected) => {
          setLive(connected);
          if (connected) setReconnects((n) => n + 1);
        },
      }),
    [conversationId],
  );

  // Fetch the newest page and merge it in; failures are ignored (the next tick tries again). Nothing is fetched while the
  // tab is hidden; coming back to the tab refreshes right away, and so does every (re)connect of the socket.
  const loaded = messages !== null;
  useEffect(() => {
    if (!loaded) return;
    const refresh = () => {
      if (document.hidden) return;
      apiFetch<ChatMessageView[]>(path)
        .then((page) => setMessages((current) => merge(current ?? [], page)))
        .catch(() => undefined);
    };
    if (reconnects > 0) refresh();
    const timer = setInterval(refresh, live ? POLL_LIVE_MS : POLL_FALLBACK_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loaded, path, live, reconnects]);

  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element) return;
    if (heightBeforePrepend.current !== null) {
      element.scrollTop = element.scrollHeight - heightBeforePrepend.current;
      heightBeforePrepend.current = null;
    } else if (stickToBottom.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  const loadEarlier = useCallback(async () => {
    const oldest = messages?.[0];
    if (!oldest) return;
    try {
      const page = await apiFetch<ChatMessageView[]>(`${path}?before=${encodeURIComponent(oldest.createdAt)}`);
      heightBeforePrepend.current = listRef.current?.scrollHeight ?? null;
      stickToBottom.current = false;
      setMessages((current) => merge(current ?? [], page));
      setHasMore(page.length >= CHAT_LIMITS.pageSize);
    } catch (error) {
      console.error('Could not load earlier messages', error);
    }
  }, [messages, path]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const created = await apiFetch<ChatMessageView>(path, { method: 'POST', body: { body } });
      stickToBottom.current = true;
      setMessages((current) => merge(current ?? [], [created]));
      setDraft('');
    } catch (error) {
      setSendError(tErrors(errorKey(error)));
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a new line.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return format.dateTime(date, sameDay ? { timeStyle: 'short' } : { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="flex items-start gap-2 border-b border-info/20 bg-info/5 px-4 py-2.5 text-xs text-info">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('adminBanner')}
      </p>

      <div
        ref={listRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label={t('title')}
        aria-busy={messages === null && !loadFailed}
      >
        {loadFailed ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-error">{t('loadError')}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setLoadFailed(false);
                setAttempt((n) => n + 1);
              }}
            >
              {tCommon('retry')}
            </Button>
          </div>
        ) : messages === null ? (
          <p className="text-sm text-muted">{t('loading')}</p>
        ) : (
          <>
            {hasMore ? (
              <div className="text-center">
                <Button variant="ghost" className="h-9 px-3 text-xs" onClick={() => void loadEarlier()}>
                  {t('loadEarlier')}
                </Button>
              </div>
            ) : null}
            {messages.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t('empty')}</p> : null}
            {messages.map((message) => {
              const own = message.sender.id === user?.id;
              const admin = message.sender.role === 'ADMIN';
              return (
                <div key={message.id} className={`flex flex-col ${own ? 'items-end' : 'items-start'}`}>
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-muted">
                    <span className="font-semibold text-text">{own ? t('you') : message.sender.name}</span>
                    {!own && !admin ? <span>· {t(`roles.${message.sender.role}`)}</span> : null}
                    {!own && admin ? (
                      <span className="rounded-full border border-gold/50 bg-gold/15 px-2 py-px text-[10px] font-bold text-gold-text">
                        {t('adminLabel')}
                      </span>
                    ) : null}
                  </p>
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-card px-3.5 py-2 text-sm ${
                      own
                        ? 'bg-primary text-white'
                        : admin
                          ? 'border border-gold/40 bg-gold/15 text-text'
                          : 'border border-border bg-card text-text'
                    }`}
                  >
                    {message.body}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">{formatTime(message.createdAt)}</p>
                </div>
              );
            })}
          </>
        )}
      </div>

      <form onSubmit={(event) => void send(event)} className="space-y-2 border-t border-border bg-card p-3">
        <FormErrors messages={sendError ? [sendError] : []} />
        <label htmlFor={`chat-input-${conversationId}`} className="sr-only">
          {t('messageLabel')}
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={`chat-input-${conversationId}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={CHAT_LIMITS.bodyMax}
            placeholder={t('placeholder')}
            className={`${inputClasses} resize-none`}
          />
          <Button type="submit" disabled={sending || draft.trim() === ''} aria-label={t('send')} className="shrink-0 px-4">
            <Send className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{sending ? t('sending') : t('send')}</span>
          </Button>
        </div>
        <p className="text-xs text-muted">{t('writeHint')}</p>
      </form>
    </div>
  );
}
