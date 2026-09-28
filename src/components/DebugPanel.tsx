import React, { useEffect, useState } from 'react';
import queue from '../lib/queue';
import queueProcessor from '../lib/queueProcessor';

export function DebugPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [running, setRunning] = useState(false);

  const refresh = async () => {
    const all = await queue.peekAll();
    setItems(all || []);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <h3>Debug Panel</h3>
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => { void refresh(); }}>刷新队列</button>
        <button
          onClick={async () => {
            setRunning(true);
            await queueProcessor.runQueueOnce();
            setRunning(false);
            await refresh();
          }}
        >
          手动处理一项
        </button>
        <button
          onClick={async () => {
            await queue.clearQueue();
            await refresh();
          }}
        >
          清空队列
        </button>
        <button
          onClick={() => {
            try {
              // toggle mock via localStorage
              const enabled = localStorage.getItem('voxflow_mock') === '1';
              if (enabled) localStorage.removeItem('voxflow_mock');
              else localStorage.setItem('voxflow_mock', '1');
              location.reload();
            } catch {
              // noop
            }
          }}
        >
          切换 Mock
        </button>
      </div>
      <div>
        <strong>队列项：{items.length}</strong>
        <ul>
          {items.map((it) => (
            <li key={it.id}>{it.id} — attempts:{it.attempts || 0}</li>
          ))}
        </ul>
      </div>
      <div>{running ? '处理运行中...' : ''}</div>
    </div>
  );
}

export default DebugPanel;
