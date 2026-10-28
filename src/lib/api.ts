import type { ChatInput, TaskMap, TaskName } from '../../shared/tasks.ts';
import { idToken } from './firebase.ts';
import { offlineChat, offlineTask } from '../ai/offline.ts';
import { USAGE_MARK, type TokenUsage } from '../../shared/pricing.ts';
import { capReached, CapReachedError, recordAi } from './usage.ts';

export interface ServerStatus {
  speech: boolean;
  tutor: boolean;
  auth: boolean;
  model: string;
}

let statusPromise: Promise<ServerStatus> | undefined;

/** What the server can do. With nothing configured, everything runs on the offline stand-ins. */
export function serverStatus(): Promise<ServerStatus> {
  statusPromise ??= fetch('/api/status')
    .then((r) => (r.ok ? (r.json() as Promise<ServerStatus>) : Promise.reject(new Error(String(r.status)))))
    .catch(() => ({ speech: false, tutor: false, auth: false, model: '' }));
  return statusPromise;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await idToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {}

async function post(body: unknown, signal?: AbortSignal): Promise<Response> {
  const res = await fetch('/api/tutor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const msg = await res
      .json()
      .then((j: { error?: string }) => j.error)
      .catch(() => undefined);
    throw new ApiError(msg ?? `Request failed (${res.status})`);
  }
  return res;
}

export async function aiTask<K extends TaskName>(task: K, input: TaskMap[K][0]): Promise<TaskMap[K][1]> {
  if (!(await serverStatus()).tutor) return offlineTask(task, input);
  if (capReached()) throw new CapReachedError();
  const res = await post({ task, input });
  const usage = res.headers.get('X-Usage');
  if (usage) recordAi(JSON.parse(usage) as TokenUsage);
  return (await res.json()) as TaskMap[K][1];
}

/** Streams the tutor's next turn; onText gets each new piece of text. Resolves with the full reply. */
export async function aiChat(input: ChatInput, onText: (piece: string) => void, signal?: AbortSignal): Promise<string> {
  if (!(await serverStatus()).tutor) return offlineChat(input, onText, signal);
  if (capReached()) throw new CapReachedError();
  const res = await post({ task: 'chat', input }, signal);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let meta = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    let piece = decoder.decode(value, { stream: true });
    // Everything after the usage mark is usage data, not speech.
    const cut = piece.indexOf(USAGE_MARK);
    if (meta || cut >= 0) {
      meta += cut >= 0 ? piece.slice(cut + 1) : piece;
      piece = cut >= 0 ? piece.slice(0, cut) : '';
    }
    if (piece.includes('[[error]]')) throw new ApiError('The tutor lost the connection. Try again.');
    if (!piece) continue;
    full += piece;
    onText(piece);
  }
  if (meta) {
    try {
      recordAi(JSON.parse(meta) as TokenUsage);
    } catch {
      /* usage is best effort */
    }
  }
  return full;
}

export async function speechToken(): Promise<{ token: string; region: string; expiresAt: number }> {
  const res = await fetch('/api/speech-token', { headers: await authHeaders() });
  if (!res.ok) {
    const msg = await res
      .json()
      .then((j: { error?: string }) => j.error)
      .catch(() => undefined);
    throw new ApiError(msg ?? `Speech token failed (${res.status})`);
  }
  return res.json();
}
