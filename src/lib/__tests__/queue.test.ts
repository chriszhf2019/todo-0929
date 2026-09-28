import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import queue, { enqueue, dequeue, peekAll, clearQueue } from '../queue';

describe('queue', () => {
  beforeEach(async () => {
    await clearQueue();
  });

  afterEach(async () => {
    await clearQueue();
  });

  it('enqueues and dequeues items', async () => {
    await enqueue({ id: '1', payload: { foo: 'bar' }, createdAt: Date.now() });
    await enqueue({ id: '2', payload: { baz: 'qux' }, createdAt: Date.now() });
    const all = await peekAll();
    expect(all.length).toBe(2);
    const first = await dequeue();
    expect(first?.id).toBe('1');
    const second = await dequeue();
    expect(second?.id).toBe('2');
    const empty = await peekAll();
    expect(empty.length).toBe(0);
  });
});
