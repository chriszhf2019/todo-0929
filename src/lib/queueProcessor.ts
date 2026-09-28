import queue from './queue';
import { dequeue } from './queue';
import { processIngestItem } from './aiPipeline';

let running = false;

const noopSetItems = (updater: (prev: any[]) => any[]) => {};
const noopSetProcessing = (id: string | null) => {};
const noopToast = (msg: string, t?: 'success' | 'info') => {};

const defaultGemma = { mode: 'local_gemma', localEndpoint: 'http://localhost:11434', modelTag: 'gemma4:latest', isConnected: false };
const defaultOnDevice = { downloaded: false };

export async function runQueueOnce() {
  const item = await dequeue();
  if (!item) return false;
  try {
    await processIngestItem(item.payload as any, {
      setItems: noopSetItems,
      setIsProcessingId: noopSetProcessing,
      showToast: noopToast,
      gemmaConfig: defaultGemma,
      onDeviceModel: defaultOnDevice,
    });
    return true;
  } catch (err) {
    const attempts = (item.attempts || 0) + 1;
    if (attempts < 3) {
      await queue.enqueue({ ...item, attempts });
    }
    return false;
  }
}

export function startQueueProcessor(interval = 3000) {
  if (running) return;
  running = true;
  const id = setInterval(async () => {
    try {
      await runQueueOnce();
    } catch {
      // ignore
    }
  }, interval);
  return () => {
    clearInterval(id);
    running = false;
  };
}

export default { runQueueOnce, startQueueProcessor };
