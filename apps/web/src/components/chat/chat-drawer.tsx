'use client';

import type { CatalogProduct, ConversationView } from '@balitrade/shared';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch, errorKey } from '@/lib/api';
import { ChatPanel } from './chat-panel';

type State = { kind: 'starting' } | { kind: 'ready'; conversationId: string } | { kind: 'failed'; message: string };

/**
 * Side drawer for the buyer's conversation about a product. Render it only while it is open: mounting starts
 * (or reopens) the conversation, unmounting closes it. Uses the native <dialog> for focus handling and Esc.
 */
export function ChatDrawer({ product, onClose }: { product: CatalogProduct; onClose: () => void }) {
  const t = useTranslations('Chat');
  const tErrors = useTranslations('Errors');
  const tCommon = useTranslations('Common');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>({ kind: 'starting' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ConversationView>('/conversations', { method: 'POST', body: { productId: product.id } })
      .then((conversation) => !cancelled && setState({ kind: 'ready', conversationId: conversation.id }))
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Could not start the conversation', error);
        setState({ kind: 'failed', message: tErrors(errorKey(error)) });
      });
    return () => {
      cancelled = true;
    };
  }, [product.id, attempt, tErrors]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dimmed backdrop (the dialog element itself) closes the drawer.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      aria-labelledby="chat-drawer-title"
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-[420px] border-l border-border bg-card p-0 text-text shadow-xl backdrop:bg-black/40"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="chat-drawer-title" className="text-base font-semibold">
              {t('inquiryTitle')}
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted">{product.title}</p>
            <p className="mt-1 text-xs text-muted">
              {t('youBuyer')} · {t('sellerLabel', { name: product.seller.displayName })} · {t('adminLabel')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t('close')}
            className="rounded-button p-2 text-muted hover:bg-background hover:text-text focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1">
          {state.kind === 'starting' ? (
            <p className="p-4 text-sm text-muted" aria-busy="true">
              {t('loading')}
            </p>
          ) : state.kind === 'failed' ? (
            <div role="alert" className="flex flex-col items-start gap-3 p-4">
              <p className="text-error">{t('startError')}</p>
              <p className="text-sm text-muted">{state.message}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setState({ kind: 'starting' });
                  setAttempt((n) => n + 1);
                }}
              >
                {tCommon('retry')}
              </Button>
            </div>
          ) : (
            <ChatPanel key={state.conversationId} conversationId={state.conversationId} />
          )}
        </div>
      </div>
    </dialog>
  );
}
