const QUEUE_KEY = 'voxflow_process_queue_v1';

export type QueueItem<T = any> = {
  id: string;
  payload: T;
  attempts?: number;
  createdAt: number;
};

// In-memory fallback for non-browser or test environments (no localStorage)
let inMemoryQueue: QueueItem[] = [];

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function loadQueue<T>(): QueueItem<T>[] {
  if (!hasStorage()) return inMemoryQueue as QueueItem<T>[];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueueItem<T>[]) : [];
  } catch {
    return inMemoryQueue as QueueItem<T>[];
  }
}

function saveQueue<T>(list: QueueItem<T>[]) {
  if (!hasStorage()) {
    inMemoryQueue = list as QueueItem[];
    return;
  }
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch {
    inMemoryQueue = list as QueueItem[];
  }
}

export async function enqueue<T>(item: QueueItem<T>) {
  const list = loadQueue<T>();
  list.push(item);
  saveQueue(list);
}

export async function dequeue<T>() {
  const list = loadQueue<T>();
  const item = list.shift();
  saveQueue(list);
  return item;
}

export async function peekAll<T>() {
  return loadQueue<T>();
}

export async function clearQueue() {
  if (!hasStorage()) {
    inMemoryQueue = [];
    return;
  }
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    inMemoryQueue = [];
  }
}

export async function requeue<T>(item: QueueItem<T>) {
  await enqueue(item);
}

export default { enqueue, dequeue, peekAll, clearQueue, requeue };
