import { makePreview } from './notifications.service.js';

describe('makePreview', () => {
  it('keeps a short message as it is', () => {
    expect(makePreview('Can I get 30 pieces?')).toBe('Can I get 30 pieces?');
  });

  it('turns line breaks and runs of spaces into single spaces and trims', () => {
    expect(makePreview('  Hello\n\nthere   friend \n')).toBe('Hello there friend');
  });

  it('cuts a long message to the limit including the ellipsis', () => {
    const preview = makePreview('a'.repeat(300));
    expect(preview).toHaveLength(100);
    expect(preview.endsWith('…')).toBe(true);
    expect(makePreview('b'.repeat(100))).toHaveLength(100); // exactly at the limit: untouched
  });
});
