import {
  OrderStatus,
  actionActor,
  canSubmitPayment,
  nextOrderStatus,
  orderActionsFor,
  orderNumberFromCode,
  paymentPurposeFor,
} from '@balitrade/shared';
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

  it('quality control (T18): OPS reports, the buyer approves or reports a problem, OPS checks again', () => {
    expect(nextOrderStatus('IN_QC', 'SUBMIT_QC')).toBe('QC_READY');
    expect(nextOrderStatus('QC_READY', 'APPROVE_QC')).toBe('QC_APPROVED');
    expect(nextOrderStatus('QC_READY', 'REPORT_ISSUE')).toBe('ISSUE');
    expect(nextOrderStatus('ISSUE', 'REDO_QC')).toBe('IN_QC');
    // Nothing to approve before a report exists, and a problem is never a cancellation.
    expect(nextOrderStatus('IN_QC', 'APPROVE_QC')).toBeNull();
    expect(nextOrderStatus('ISSUE', 'APPROVE_QC')).toBeNull();
    expect(nextOrderStatus('ISSUE', 'CANCEL')).toBeNull();
    expect(nextOrderStatus('QC_READY', 'SUBMIT_QC')).toBeNull();
    expect(nextOrderStatus('QC_APPROVED', 'REPORT_ISSUE')).toBeNull();
    expect(nextOrderStatus('PAYMENT_VERIFIED', 'SUBMIT_QC')).toBeNull();
    expect(['SUBMIT_QC', 'REDO_QC'].map((a) => actionActor(a as OrderAction))).toEqual(['ADMIN', 'ADMIN']);
    expect(['APPROVE_QC', 'REPORT_ISSUE'].map((a) => actionActor(a as OrderAction))).toEqual(['BUYER', 'BUYER']);
    // The QC panel offers these, not the order page's button row.
    expect(orderActionsFor('BUYER', 'QC_READY')).toEqual([]);
  });

  it('shipping (T19): bill, pay, confirm, then the tracking milestones move the order', () => {
    expect(nextOrderStatus('QC_APPROVED', 'ISSUE_SHIPPING_BILL')).toBe('AWAITING_SHIPPING_PAYMENT');
    expect(nextOrderStatus('AWAITING_SHIPPING_PAYMENT', 'REVISE_SHIPPING_BILL')).toBe('AWAITING_SHIPPING_PAYMENT');
    expect(nextOrderStatus('AWAITING_SHIPPING_PAYMENT', 'SUBMIT_PAYMENT')).toBe('AWAITING_SHIPPING_PAYMENT');
    expect(nextOrderStatus('AWAITING_SHIPPING_PAYMENT', 'CONFIRM_SHIPPING_PAID')).toBe('SHIPPING_PAID');
    expect(nextOrderStatus('SHIPPING_PAID', 'SHIP')).toBe('SHIPPED');
    expect(nextOrderStatus('SHIPPED', 'DELIVER')).toBe('ARRIVED');
    // A rejected shipping proof has no status to step back to, and nothing ships before the money is confirmed.
    expect(nextOrderStatus('AWAITING_SHIPPING_PAYMENT', 'REJECT_PAYMENT')).toBeNull();
    expect(nextOrderStatus('AWAITING_SHIPPING_PAYMENT', 'SHIP')).toBeNull();
    expect(nextOrderStatus('QC_READY', 'ISSUE_SHIPPING_BILL')).toBeNull();
    expect(nextOrderStatus('SHIPPING_PAID', 'REVISE_SHIPPING_BILL')).toBeNull();
    expect(nextOrderStatus('SHIPPED', 'CANCEL')).toBeNull();
    expect(canSubmitPayment('BUYER', 'AWAITING_SHIPPING_PAYMENT')).toBe(true);
    expect(canSubmitPayment('BUYER', 'SHIPPING_PAID')).toBe(false);
  });

  it('the payment purpose follows the order status, never the client', () => {
    expect(paymentPurposeFor('AWAITING_PAYMENT')).toBe('GOODS');
    expect(paymentPurposeFor('PAYMENT_SUBMITTED')).toBe('GOODS');
    expect(paymentPurposeFor('AWAITING_SHIPPING_PAYMENT')).toBe('SHIPPING');
    for (const status of ['REQUESTED', 'IN_QC', 'QC_APPROVED', 'SHIPPING_PAID', 'SHIPPED'] as const) {
      expect(paymentPurposeFor(status)).toBeNull();
    }
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

describe('orderNumberFromCode (admin search, T27)', () => {
  it('reads the code an admin types', () => {
    expect(orderNumberFromCode('OR-1043')).toBe(43);
    expect(orderNumberFromCode('or 1043')).toBe(43);
    expect(orderNumberFromCode('Anna')).toBeNull();
  });

  it('ignores digits too long for the 32-bit column (they used to reach the database and answer 500)', () => {
    expect(orderNumberFromCode('Pager1763600000000')).toBeNull();
    expect(orderNumberFromCode(String(1000 + 2_147_483_647))).toBe(2_147_483_647);
    expect(orderNumberFromCode(String(1000 + 2_147_483_648))).toBeNull();
  });
});
