import { OrderStatus, actionActor, nextOrderStatus, orderActionsFor } from '@balitrade/shared';
import type { OrderAction } from '@balitrade/shared';

describe('order transitions (docs/ARCHITECTURE.md §6)', () => {
  it('a requested order: the seller accepts, declines or proposes a change; the buyer cancels', () => {
    expect(nextOrderStatus('REQUESTED', 'ACCEPT')).toBe('AWAITING_PAYMENT');
    expect(nextOrderStatus('REQUESTED', 'DECLINE')).toBe('DECLINED');
    expect(nextOrderStatus('REQUESTED', 'PROPOSE_CHANGE')).toBe('CHANGE_PROPOSED');
    expect(nextOrderStatus('REQUESTED', 'CANCEL')).toBe('CANCELLED');
    expect(nextOrderStatus('REQUESTED', 'ACCEPT_CHANGE')).toBeNull(); // nothing to accept yet
  });

  it('a proposed change: the buyer accepts or cancels; the seller can revise or withdraw it, not accept', () => {
    expect(nextOrderStatus('CHANGE_PROPOSED', 'ACCEPT_CHANGE')).toBe('AWAITING_PAYMENT');
    expect(nextOrderStatus('CHANGE_PROPOSED', 'CANCEL')).toBe('CANCELLED');
    expect(nextOrderStatus('CHANGE_PROPOSED', 'PROPOSE_CHANGE')).toBe('CHANGE_PROPOSED');
    expect(nextOrderStatus('CHANGE_PROPOSED', 'DECLINE')).toBe('DECLINED');
    expect(nextOrderStatus('CHANGE_PROPOSED', 'ACCEPT')).toBeNull();
  });

  it('before payment the buyer can still cancel, and nothing else happens in that status yet', () => {
    expect(nextOrderStatus('AWAITING_PAYMENT', 'CANCEL')).toBe('CANCELLED');
    for (const action of ['ACCEPT', 'DECLINE', 'PROPOSE_CHANGE', 'ACCEPT_CHANGE'] as OrderAction[]) {
      expect(nextOrderStatus('AWAITING_PAYMENT', action)).toBeNull();
    }
  });

  it('ended orders accept no action at all', () => {
    for (const status of ['DECLINED', 'CANCELLED', 'REFUNDED', 'COMPLETED'] as const) {
      for (const action of ['ACCEPT', 'DECLINE', 'PROPOSE_CHANGE', 'ACCEPT_CHANGE', 'CANCEL'] as OrderAction[]) {
        expect(nextOrderStatus(status, action)).toBeNull();
      }
    }
  });

  it('every status of the enum answers without throwing (statuses of later tasks simply have no action yet)', () => {
    for (const status of Object.values(OrderStatus)) {
      expect(() => nextOrderStatus(status, 'CANCEL')).not.toThrow();
    }
  });

  it('names who takes each action', () => {
    expect(['ACCEPT', 'DECLINE', 'PROPOSE_CHANGE'].map((a) => actionActor(a as OrderAction))).toEqual(['SELLER', 'SELLER', 'SELLER']);
    expect(['ACCEPT_CHANGE', 'CANCEL'].map((a) => actionActor(a as OrderAction))).toEqual(['BUYER', 'BUYER']);
  });

  it('lists the actions per viewer and status; admins get none', () => {
    expect(orderActionsFor('SELLER', 'REQUESTED')).toEqual(['ACCEPT', 'DECLINE', 'PROPOSE_CHANGE']);
    expect(orderActionsFor('BUYER', 'REQUESTED')).toEqual(['CANCEL']);
    expect(orderActionsFor('BUYER', 'CHANGE_PROPOSED')).toEqual(['ACCEPT_CHANGE', 'CANCEL']);
    expect(orderActionsFor('SELLER', 'CHANGE_PROPOSED')).toEqual(['DECLINE', 'PROPOSE_CHANGE']);
    expect(orderActionsFor('BUYER', 'AWAITING_PAYMENT')).toEqual(['CANCEL']);
    expect(orderActionsFor('SELLER', 'AWAITING_PAYMENT')).toEqual([]);
    expect(orderActionsFor('ADMIN', 'REQUESTED')).toEqual([]);
    expect(orderActionsFor('BUYER', 'CANCELLED')).toEqual([]);
  });
});
