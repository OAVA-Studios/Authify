import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

let toastId = 0;
const listeners = new Set<(toasts: ToastItem[]) => void>();
let toasts: ToastItem[] = [];

interface ToastItem {
  id: number;
  message: string;
  type?: 'success' | 'error' | 'info';
}

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export function toast(message: string, type?: 'success' | 'error' | 'info') {
  const id = ++toastId;
  const item: ToastItem = { id, message };
  if (type !== undefined) item.type = type;
  toasts.push(item);
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 4000);
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium shadow-lg border',
            t.type === 'error' && 'bg-red-900/80 text-red-100 border-red-800',
            t.type === 'success' && 'bg-emerald-900/80 text-emerald-100 border-emerald-800',
            !t.type && 'bg-slate-800 text-slate-100 border-slate-700'
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
