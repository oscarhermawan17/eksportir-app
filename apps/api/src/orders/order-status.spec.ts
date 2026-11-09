import { OrderStatus, actionActor, canSubmitPayment, nextOrderStatus, orderActionsFor } from '@balitrade/shared';
import type { OrderAction } from '@balitrade/shared';

describe('order transitions (docs/ARCHITECTURE.md §6)', () => {
  it('payment: the buyer may send several, and only CONFIRM_PAID reaches PAYMENT_VERIFIED (T17)', () => {
    expect(nextOrderStatus('AWAITING_PAYMENT', 'SUBMIT_PAYMENT')).toBe('PAYMENT_SUBMITTED');
    // Partial transfers are accepted, so paying again while one proof is still being checked is normal.
    expect(nextOrderStatus('PAYMENT_SUBMITTED', 'SUBMIT_PAYMENT')).toBe('PAYMENT_SUBMITTED');
    expect(nextOrderStatus('PAYMENT_SUBMITTED', 'REJECT_PAYMENT')).toBe('AWAITING_PAYMENT');
    expect(nextOrderStatus('PAYMENT_SUBMITTED', 'CONFIRM_PAID')).toBe('PAYMENT_VERIFIED');
    // Confirming "paid" is only possible while a payment is on the table, never before one arrives.
    expect(nextOrderStatus('AWAITING_PAYMENT', 'CONFIRM_PAID')).toBeNull();
  });

  it('quality control starts as its own step, after the payment is verified (T17 DoD, T18 fills it in)', () => {
    expect(nextOrderStatus('PAYMENT_VERIFIED', 'START_QC')).toBe('IN_QC');
    expect(nextOrderStatus('PAYMENT_SUBMITTED', 'START_QC')).toBeNull();
    expect(nextOrderStatus('AWAITING_PAYMENT', 'START_QC')).toBeNull();
  });

  it('money and QC belong to the admin side; paying is the buyer\'s', () => {
    expect(actionActor('CONFIRM_PAID')).toBe('ADMIN');
    expect(actionActor('REJECT_PAYMENT')).toBe('ADMIN');
    expect(actionActor('START_QC')).toBe('ADMIN');
    expect(actionActor('SUBMIT_PAYMENT')).toBe('BUYER');
  });

  it('the payment screen is not a button: it never shows up in the order page action list', () => {
    expect(canSubmitPayment('BUYER', 'AWAITING_PAYMENT')).toBe(true);
    expect(canSubmitPayment('BUYER', 'PAYMENT_SUBMITTED')).toBe(true);
    expect(canSubmitPayment('BUYER', 'PAYMENT_VERIFIED')).toBe(false);
    expect(canSubmitPayment('SELLER', 'AWAITING_PAYMENT')).toBe(false);
    expect(orderActionsFor('BUYER', 'AWAITING_PAYMENT')).toEqual(['CANCEL']);
    for (const status of Object.values(OrderStatus)) {
      expect(orderActionsFor('ADMIN', status)).toEqual([]);
      for (const viewer of ['BUYER', 'SELLER'] as const) {
        expect(orderActionsFor(viewer, status)).not.toContain('SUBMIT_PAYMENT');
      }
    }
  });

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
