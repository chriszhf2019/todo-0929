import { extractLocally as extractLocallySync } from './localExtraction';

self.addEventListener('message', (ev) => {
  const { id, action, payload } = ev.data as any;
  if (action === 'extract') {
    try {
      const result = extractLocallySync(payload);
      // post result back
      // @ts-ignore
      self.postMessage({ id, success: true, result });
    } catch (err) {
      // @ts-ignore
      self.postMessage({ id, success: false, error: String(err) });
    }
  }
});
