/**
 * Tüm sunucu iletişimi buradan geçer.
 *
 * - Lovable önizlemesi / Node çalıştırması: `/api/mmpi` (TanStack sunucu route'u)
 * - Statik `dist` + cPanel PHP kurulumu: `/api/mmpi.php`
 *
 * Uç nokta otomatik tespit edilir; istenirse `VITE_API_URL` ile sabitlenebilir.
 */
import type { AnswerValue, Gender, MmpiResults } from "@/lib/mmpi-scoring";

const CANDIDATES = ["/api/mmpi", "/api/mmpi.php"];
const configured = import.meta.env["VITE_API_URL"] as string | undefined;

let resolvedEndpoint: string | null = configured ?? null;

async function post<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const endpoints = resolvedEndpoint ? [resolvedEndpoint] : CANDIDATES;
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Ağ hatası");
      continue;
    }

    if (response.status === 404 || response.status === 405) {
      lastError = new Error("Sunucu uç noktası bulunamadı.");
      continue;
    }

    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      lastError = new Error("Sunucu geçersiz yanıt döndürdü.");
      continue;
    }

    const data = body as { ok?: boolean; error?: string; data?: T };
    if (!response.ok || data.ok === false) {
      throw new Error(data.error ?? `Sunucu hatası (${response.status})`);
    }
    resolvedEndpoint = endpoint;
    return (data.data ?? (data as unknown)) as T;
  }

  throw lastError ?? new Error("Sunucuya ulaşılamadı.");
}

export type SessionParticipant = {
  full_name: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string;
};

export type LoadedSession = {
  token: string;
  participant: SessionParticipant;
  status: string;
  startedAt: string;
  finishedAt: string;
  leaveCount: number;
  lastLeftAt: string | null;
  lastReturnedAt: string | null;
  durationSeconds: number;
  lastQuestion: number;
  answers: Record<number, AnswerValue>;
  results: MmpiResults | null;
};

export type FinishParticipant = {
  full_name: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  ip_address: string | null;
  duration_seconds: number;
  started_at: string;
  finished_at: string;
  leave_count: number;
  last_left_at: string | null;
  last_returned_at: string | null;
};

export type AdminSessionRow = {
  id: string;
  full_name: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  ip_address: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  answered_count: number | null;
  last_question: number | null;
  leave_count: number | null;
  last_left_at: string | null;
  last_returned_at: string | null;
  email_sent_at: string | null;
  results: MmpiResults | null;
};

export const api = {
  startSession: (participant: {
    fullName: string;
    age: number;
    gender: string;
    phone: string;
    email: string;
  }) => post<{ token: string }>("start", participant),

  getSession: (token: string) => post<LoadedSession | null>("get", { token }),

  saveAnswer: (input: {
    token: string;
    questionNo: number;
    answer: AnswerValue;
    elapsedSeconds: number;
    lastQuestion: number;
  }) => post<{ locked: boolean; answeredCount: number }>("answer", input),

  logEvent: (input: {
    token: string;
    eventType: "left_page" | "returned_page" | "test_restarted" | "test_resumed";
    questionNo?: number;
    elapsedSeconds?: number;
  }) => post<{ ok: boolean }>("event", input),

  restartSession: (token: string) => post<{ token: string }>("restart", { token }),

  finishSession: (input: { token: string; elapsedSeconds: number; results: MmpiResults }) =>
    post<{ participant: FinishParticipant }>("finish", input),

  sendResultEmails: (input: {
    token: string;
    subject: string;
    participantHtml: string;
    adminHtml: string;
  }) => post<{ sent: boolean; error?: string }>("email", input),

  adminSessions: (username: string, password: string) =>
    post<{ sessions: AdminSessionRow[] }>("admin", { username, password }),
};
