'use client';

import type { AuthUser, ConversationView } from '@balitrade/shared';
import { isAdmin } from '@balitrade/shared';
import { ArrowLeft, ImageOff } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { ChatPanel } from '@/components/chat/chat-panel';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

const REFRESH_MS = 8000;

export function MessagesView() {
  return <LoginGate>{(user) => <Inbox user={user} />}</LoginGate>;
}

function Inbox({ user }: { user: AuthUser }) {
  const t = useTranslations('Chat');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const selectedId = useSearchParams().get('c');
  const [conversations, setConversations] = useState<ConversationView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      apiFetch<ConversationView[]>('/conversations')
        .then((list) => {
          if (!cancelled) setConversations(list);
        })
        .catch((error: unknown) => {
          console.error('Could not load conversations', error);
          if (!cancelled) setFailed(true);
        });
    void load();
    // Keep the list (previews, order) fresh while the tab is visible, and refresh as soon as the tab is shown again.
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [attempt]);

  const admin = isAdmin(user.roles);
  const selected = conversations?.find((conversation) => conversation.id === selectedId) ?? null;

  /** Who the viewer is talking with; admins see both sides. */
  const counterpart = (conversation: ConversationView): string => {
    if (admin) return t('adminLine', { buyer: conversation.buyer.name, seller: conversation.seller.displayName });
    return conversation.buyer.id === user.id ? conversation.seller.displayName : conversation.buyer.name;
  };

  const formatWhen = (iso: string) => {
    const date = new Date(iso);
    const sameDay = date.toDateString() === new Date().toDateString();
    return format.dateTime(date, sameDay ? { timeStyle: 'short' } : { dateStyle: 'medium' });
  };

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-bold text-text">{t('title')}</h1>

      {failed ? (
        <div role="alert" className="mt-6 flex flex-col items-start gap-3">
          <p className="text-error">{t('loadError')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setFailed(false);
              setConversations(null);
              setAttempt((n) => n + 1);
            }}
          >
            {tCommon('retry')}
          </Button>
        </div>
      ) : conversations === null ? (
        <p className="mt-6 text-muted" aria-busy="true">
          {t('loading')}
        </p>
      ) : conversations.length === 0 ? (
        <p className="mt-6 rounded-card border border-border bg-card px-5 py-10 text-center text-muted">{t('inboxEmpty')}</p>
      ) : (
        <div className="mt-6 grid gap-4 md:h-[calc(100dvh-14rem)] md:min-h-[28rem] md:grid-cols-[320px_1fr]">
          <ul className={`${selected ? 'hidden md:block' : ''} space-y-2 overflow-y-auto`} aria-label={t('title')}>
            {conversations.map((conversation) => {
              const active = conversation.id === selectedId;
              return (
                <li key={conversation.id}>
                  <Link
                    href={`/messages?c=${conversation.id}`}
                    aria-current={active ? 'true' : undefined}
                    className={`flex gap-3 rounded-card border p-3 transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary ${
                      active ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    }`}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background text-muted">
                      {conversation.product?.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
                        <img src={conversation.product.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageOff className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-text">{counterpart(conversation)}</span>
                        {conversation.lastMessageAt ? (
                          <span className="shrink-0 text-[11px] text-muted">{formatWhen(conversation.lastMessageAt)}</span>
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted">{conversation.product?.title ?? t('conversation')}</span>
                      <span className="block truncate text-sm text-text">
                        {conversation.lastMessage ? conversation.lastMessage.body : <span className="text-muted">{t('noMessagesYet')}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <section
            className={`${selected ? '' : 'hidden md:flex'} min-h-[28rem] flex-col overflow-hidden rounded-card border border-border bg-card md:min-h-0`}
            aria-label={selected ? counterpart(selected) : t('pickOne')}
          >
            {selected ? (
              <>
                <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <Link href="/messages" className="rounded-button p-1.5 text-muted hover:bg-background hover:text-text md:hidden" aria-label={t('backToList')}>
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-text">{counterpart(selected)}</h2>
                    <p className="truncate text-xs text-muted">{selected.product?.title ?? t('conversation')}</p>
                  </div>
                  {selected.product ? (
                    <Link href={`/products/${selected.product.id}`} className="shrink-0 text-sm font-semibold text-primary hover:underline">
                      {t('viewProduct')}
                    </Link>
                  ) : null}
                </header>
                <div className="min-h-0 flex-1">
                  <ChatPanel key={selected.id} conversationId={selected.id} />
                </div>
              </>
            ) : (
              <p className="m-auto px-6 text-center text-muted">{t('pickOne')}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
