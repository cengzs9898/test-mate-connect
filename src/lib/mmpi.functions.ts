import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeResults, type AnswerMap, type Gender } from "@/lib/mmpi-scoring";

const registrationSchema = z.object({
  fullName: z.string().trim().min(3, "Ad soyad en az 3 karakter olmalı").max(120),
  age: z.coerce.number().int().min(16, "Yaş en az 16 olmalı").max(99),
  gender: z.enum(["male", "female"]),
  phone: z.string().trim().min(10, "Geçerli bir telefon numarası girin").max(25),
  email: z.string().trim().email("Geçerli bir e-posta adresi girin").max(160),
});

function clientIp(): string | null {
  try {
    const request = getRequest();
    const headers = request.headers;
    return (
      headers.get("cf-connecting-ip") ??
      headers.get("x-real-ip") ??
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null
    );
  } catch {
    return null;
  }
}

function userAgent(): string | null {
  try {
    return getRequest().headers.get("user-agent");
  } catch {
    return null;
  }
}

export const startSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registrationSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = clientIp();
    const { data: session, error } = await supabaseAdmin
      .from("test_sessions")
      .insert({
        full_name: data.fullName,
        age: data.age,
        gender: data.gender,
        phone: data.phone,
        email: data.email,
        ip_address: ip,
        user_agent: userAgent(),
      })
      .select("id, session_token, full_name, age, gender, phone, email, started_at")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("session_events").insert({
      session_id: session.id,
      event_type: "test_started",
      ip_address: ip,
    });

    return { token: session.session_token as string };
  });

const tokenSchema = z.object({ token: z.string().uuid() });

export const getSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("test_sessions")
      .select("*")
      .eq("session_token", data.token)
      .maybeSingle();
    if (!session) return null;

    const { data: answers } = await supabaseAdmin
      .from("test_answers")
      .select("question_no, answer")
      .eq("session_id", session.id);

    const answerMap: Record<number, "D" | "Y"> = {};
    for (const row of answers ?? []) answerMap[row.question_no] = row.answer as "D" | "Y";

    return {
      token: session.session_token as string,
      participant: {
        full_name: session.full_name,
        age: session.age,
        gender: session.gender as Gender,
        phone: session.phone,
        email: session.email,
      },
      status: session.status as string,
      durationSeconds: session.duration_seconds as number,
      lastQuestion: session.last_question as number,
      answers: answerMap,
      results: session.results as unknown,
    };
  });

export const saveAnswer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().uuid(),
        questionNo: z.number().int().min(1).max(566),
        answer: z.enum(["D", "Y"]),
        elapsedSeconds: z.number().int().min(0).max(200000),
        lastQuestion: z.number().int().min(1).max(566),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("test_sessions")
      .select("id, status")
      .eq("session_token", data.token)
      .maybeSingle();
    if (!session) throw new Error("Oturum bulunamadı.");
    if (session.status === "completed") throw new Error("Bu test zaten tamamlandı.");

    const { data: existing } = await supabaseAdmin
      .from("test_answers")
      .select("id")
      .eq("session_id", session.id)
      .eq("question_no", data.questionNo)
      .maybeSingle();

    // Cevaplar kilitlidir: verilmiş bir cevap değiştirilemez.
    if (!existing) {
      await supabaseAdmin.from("test_answers").insert({
        session_id: session.id,
        question_no: data.questionNo,
        answer: data.answer,
      });
    }

    const { count } = await supabaseAdmin
      .from("test_answers")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id);

    await supabaseAdmin
      .from("test_sessions")
      .update({
        duration_seconds: data.elapsedSeconds,
        last_question: data.lastQuestion,
        answered_count: count ?? 0,
      })
      .eq("id", session.id);

    return { locked: Boolean(existing), answeredCount: count ?? 0 };
  });

export const logEvent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().uuid(),
        eventType: z.enum(["left_page", "returned_page", "test_restarted", "test_resumed"]),
        questionNo: z.number().int().min(1).max(566).optional(),
        elapsedSeconds: z.number().int().min(0).max(200000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("test_sessions")
      .select("id, leave_count")
      .eq("session_token", data.token)
      .maybeSingle();
    if (!session) return { ok: false };

    const ip = clientIp();
    await supabaseAdmin.from("session_events").insert({
      session_id: session.id,
      event_type: data.eventType,
      question_no: data.questionNo ?? null,
      ip_address: ip,
    });

    const patch: Record<string, unknown> = {};
    if (data.eventType === "left_page") {
      patch["last_left_at"] = new Date().toISOString();
      patch["leave_count"] = (session.leave_count ?? 0) + 1;
    }
    if (data.eventType === "returned_page") patch["last_returned_at"] = new Date().toISOString();
    if (typeof data.elapsedSeconds === "number") patch["duration_seconds"] = data.elapsedSeconds;
    if (data.questionNo) patch["last_question"] = data.questionNo;
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("test_sessions").update(patch).eq("id", session.id);
    }
    return { ok: true };
  });

export const restartSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("test_sessions")
      .select("id, full_name, age, gender, phone, email")
      .eq("session_token", data.token)
      .maybeSingle();
    if (!session) throw new Error("Oturum bulunamadı.");

    const { data: fresh, error } = await supabaseAdmin
      .from("test_sessions")
      .insert({
        full_name: session.full_name,
        age: session.age,
        gender: session.gender,
        phone: session.phone,
        email: session.email,
        ip_address: clientIp(),
        user_agent: userAgent(),
      })
      .select("id, session_token")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("test_sessions").update({ status: "abandoned" }).eq("id", session.id);
    await supabaseAdmin.from("session_events").insert({
      session_id: fresh.id,
      event_type: "test_restarted",
      ip_address: clientIp(),
    });

    return { token: fresh.session_token as string };
  });

export const finishSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ token: z.string().uuid(), elapsedSeconds: z.number().int().min(0).max(200000) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("test_sessions")
      .select("*")
      .eq("session_token", data.token)
      .maybeSingle();
    if (!session) throw new Error("Oturum bulunamadı.");

    const { data: answerRows } = await supabaseAdmin
      .from("test_answers")
      .select("question_no, answer")
      .eq("session_id", session.id);

    const answers: AnswerMap = {};
    for (const row of answerRows ?? []) answers[row.question_no] = row.answer as "D" | "Y";

    const results = computeResults(answers, session.gender as Gender);
    const finishedAt = new Date().toISOString();

    await supabaseAdmin
      .from("test_sessions")
      .update({
        status: "completed",
        finished_at: finishedAt,
        duration_seconds: data.elapsedSeconds,
        answered_count: results.answered,
        results: results as unknown as Record<string, unknown>,
      })
      .eq("id", session.id);

    await supabaseAdmin.from("session_events").insert({
      session_id: session.id,
      event_type: "test_completed",
      ip_address: clientIp(),
    });

    const participant = {
      full_name: session.full_name as string,
      age: session.age as number,
      gender: session.gender as string,
      phone: session.phone as string,
      email: session.email as string,
      ip_address: session.ip_address as string | null,
      duration_seconds: data.elapsedSeconds,
      started_at: new Date(session.started_at as string).toLocaleString("tr-TR"),
      finished_at: new Date(finishedAt).toLocaleString("tr-TR"),
      leave_count: (session.leave_count as number) ?? 0,
    };

    let emailStatus: { sent: boolean; error?: string } = { sent: false };
    try {
      const { buildResultEmailHtml, sendResultEmail } = await import("@/lib/mmpi-email.server");
      const subject = `MMPI Test Sonucu — ${participant.full_name}`;
      await sendResultEmail(participant.email, subject, buildResultEmailHtml(participant, results, false));
      await sendResultEmail(
        "cengizs.98@gmail.com",
        `${subject} (yönetim kopyası)`,
        buildResultEmailHtml(participant, results, true),
      );
      await supabaseAdmin
        .from("test_sessions")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", session.id);
      emailStatus = { sent: true };
    } catch (error) {
      console.error("Sonuç e-postası gönderilemedi:", error);
      emailStatus = { sent: false, error: error instanceof Error ? error.message : "Bilinmeyen hata" };
    }

    return { results, participant, emailStatus };
  });

export const adminListSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Yetkisiz erişim.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sessions } = await supabaseAdmin
      .from("test_sessions")
      .select(
        "id, full_name, age, gender, phone, email, ip_address, status, started_at, finished_at, duration_seconds, answered_count, last_question, last_left_at, last_returned_at, leave_count, email_sent_at, results",
      )
      .order("created_at", { ascending: false })
      .limit(300);

    const { data: events } = await supabaseAdmin
      .from("session_events")
      .select("session_id, event_type, question_no, ip_address, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);

    return { sessions: sessions ?? [], events: events ?? [] };
  });
