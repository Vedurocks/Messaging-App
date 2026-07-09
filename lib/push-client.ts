// lib/push-client.ts
'use client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function isPushSupported(): Promise<boolean> {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPushSubscriptionState(): Promise<'subscribed' | 'unsubscribed' | 'unsupported'> {
  if (!(await isPushSupported())) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'unsubscribed';
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'subscribed' : 'unsubscribed';
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!(await isPushSupported())) return { ok: false, error: 'Push notifications are not supported in this browser.' };

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { ok: false, error: 'Push notifications are not configured for this app.' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, error: 'Notification permission was denied.' };

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
  });

  const json = sub.toJSON();
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });

  if (!res.ok) return { ok: false, error: 'Failed to save subscription on the server.' };
  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!(await isPushSupported())) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});

  await sub.unsubscribe();
}
