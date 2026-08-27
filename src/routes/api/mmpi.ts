import { createFileRoute } from "@tanstack/react-router";
import type { TablesUpdate } from "@/integrations/supabase/types";

/**
 * Node / Lovable ortamı için JSON API. cPanel (statik dist) kurulumunda
 * bunun PHP eşleniği `php/api/mmpi.php` dosyasıdır — aynı sözleşmeyi uygular.
 */

type Body = Record<string, unknown>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: status < 400, data }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function fail(message: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function clientIp(request: Request): string | null {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

function tr(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString("tr-TR") : "-";
}

async function handle(request: Request): Promise<Response> {
  const body = (await request.json()) as Body;
  const action = String(body["action"] ?? "");
  const token = typeof body["token"] === "string" ? (body["token"] as string) : null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ip = clientIp(request);

  if (action === "admin") {
    const expectedUser = process.env["ADMIN_PANEL_USER"] ?? "admin";
    const expectedPass = process.env["ADMIN_PANEL_PASSWORD"] ?? "@pruvapsikoloji.com";
    if (body["username"] !== expectedUser || body["password"] !== expectedPass) {
      return fail("Kullanıcı adı veya şifre hatalı.", 401);
    }
    const { data: sessions, error } = await supabaseAdmin
      .from("test_sessions")
      .select(
        "id, full_name, age, gender, phone, email, ip_address, status, started_at, finished_at, duration_seconds, answered_count, last_question, leave_count, last_left_at, last_returned_at, email_sent_at, results",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return fail(error.message, 500);
    return json({ sessions: sessions ?? [] });
  }

  if (action === "start") {
    const { data: session, error } = await supabaseAdmin
      .from("test_sessions")
      .insert({
        full_name: String(body["fullName"] ?? ""),
        age: Number(body["age"] ?? 0),
        gender: String(body["gender"] ?? "male"),
        phone: String(body["phone"] ?? ""),
        email: String(body["email"] ?? ""),
        ip_address: ip,
        user_agent: request.headers.get("user-agent"),
      })
      .select("id, session_token")
      .single();
    if (error) return fail(error.message, 500);
    await supabaseAdmin
      .from("session_events")
      .insert({ session_id: session.id, event_type: "test_started", ip_address: ip });
    return json({ token: session.session_token as string });
  }

  if (!token) return fail("Geçersiz istek.", 400);

  const { data: session } = await supabaseAdmin
    .from("test_sessions")
    .select("*")
    .eq("session_token", token)
    .maybeSingle();

  if (action === "get") {
    if (!session) return json(null);
    const { data: answers } = await supabaseAdmin
      .from("test_answers")
      .select("question_no, answer")
      .eq("session_id", session.id);
    const answerMap: Record<number, "D" | "Y"> = {};
    for (const row of answers ?? []) answerMap[row.question_no] = row.answer as "D" | "Y";
    return json({
      token,
      participant: {
        full_name: session.full_name,
        age: session.age,
        gender: session.gender,
        phone: session.phone,
        email: session.email,
      },
      status: session.status,
      startedAt: tr(session.started_at as string),
      finishedAt: tr(session.finished_at as string | null),
      leaveCount: session.leave_count ?? 0,
      lastLeftAt: session.last_left_at ? tr(session.last_left_at as string) : null,
      lastReturnedAt: session.last_returned_at ? tr(session.last_returned_at as string) : null,
      durationSeconds: session.duration_seconds ?? 0,
      lastQuestion: session.last_question ?? 1,
      answers: answerMap,
      results: session.results,
    });
  }

  if (!session) return fail("Oturum bulunamadı.", 404);

  if (action === "answer") {
    if (session.status === "completed") return fail("Bu test zaten tamamlandı.", 409);
    const questionNo = Number(body["questionNo"]);
    const { data: existing } = await supabaseAdmin
      .from("test_answers")
      .select("id")
      .eq("session_id", session.id)
      .eq("question_no", questionNo)
      .maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("test_answers").insert({
        session_id: session.id,
        question_no: questionNo,
        answer: String(body["answer"]),
      });
    }
    const { count } = await supabaseAdmin
      .from("test_answers")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id);
    await supabaseAdmin
      .from("test_sessions")
      .update({
        duration_seconds: Number(body["elapsedSeconds"] ?? 0),
        last_question: Number(body["lastQuestion"] ?? questionNo),
        answered_count: count ?? 0,
      })
      .eq("id", session.id);
    return json({ locked: Boolean(existing), answeredCount: count ?? 0 });
  }

  if (action === "event") {
    const eventType = String(body["eventType"]);
    await supabaseAdmin.from("session_events").insert({
      session_id: session.id,
      event_type: eventType,
      question_no: body["questionNo"] ? Number(body["questionNo"]) : null,
      ip_address: ip,
    });
    const patch: TablesUpdate<"test_sessions"> = {};
    if (eventType === "left_page") {
      patch["last_left_at"] = new Date().toISOString();
      patch["leave_count"] = (session.leave_count ?? 0) + 1;
    }
    if (eventType === "returned_page") patch["last_returned_at"] = new Date().toISOString();
    if (body["elapsedSeconds"] !== undefined) {
      patch["duration_seconds"] = Number(body["elapsedSeconds"]);
    }
    if (body["questionNo"] !== undefined) patch["last_question"] = Number(body["questionNo"]);
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("test_sessions").update(patch).eq("id", session.id);
    }
    return json({ ok: true });
  }

  if (action === "restart") {
    const { data: fresh, error } = await supabaseAdmin
      .from("test_sessions")
      .insert({
        full_name: session.full_name,
        age: session.age,
        gender: session.gender,
        phone: session.phone,
        email: session.email,
        ip_address: ip,
        user_agent: request.headers.get("user-agent"),
      })
      .select("id, session_token")
      .single();
    if (error) return fail(error.message, 500);
    await supabaseAdmin.from("test_sessions").update({ status: "abandoned" }).eq("id", session.id);
    await supabaseAdmin
      .from("session_events")
      .insert({ session_id: fresh.id, event_type: "test_restarted", ip_address: ip });
    return json({ token: fresh.session_token as string });
  }

  if (action === "finish") {
    const results = body["results"] as Record<string, unknown>;
    const elapsed = Number(body["elapsedSeconds"] ?? 0);
    const finishedAt = new Date().toISOString();
    await supabaseAdmin
      .from("test_sessions")
      .update({
        status: "completed",
        finished_at: finishedAt,
        duration_seconds: elapsed,
        answered_count: Number(results["answered"] ?? 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results: results as any,
      })
      .eq("id", session.id);
    await supabaseAdmin
      .from("session_events")
      .insert({ session_id: session.id, event_type: "test_completed", ip_address: ip });
    return json({
      participant: {
        full_name: session.full_name,
        age: session.age,
        gender: session.gender,
        phone: session.phone,
        email: session.email,
        ip_address: session.ip_address,
        duration_seconds: elapsed,
        started_at: tr(session.started_at as string),
        finished_at: tr(finishedAt),
        leave_count: session.leave_count ?? 0,
        last_left_at: session.last_left_at ? tr(session.last_left_at as string) : null,
        last_returned_at: session.last_returned_at ? tr(session.last_returned_at as string) : null,
      },
    });
  }

  if (action === "email") {
    const { sendResultEmail } = await import("@/lib/mmpi-email.server");
    const subject = String(body["subject"] ?? "MMPI Test Sonucu");
    try {
      await sendResultEmail(
        session.email as string,
        subject,
        String(body["participantHtml"] ?? ""),
      );
      await sendResultEmail(
        process.env["ADMIN_EMAIL"] ?? "mmpitesti@pruvapsikoloji.com",
        `${subject} (yönetim kopyası)`,
        String(body["adminHtml"] ?? ""),
      );
      await supabaseAdmin
        .from("test_sessions")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", session.id);
      return json({ sent: true });
    } catch (error) {
      return json({ sent: false, error: error instanceof Error ? error.message : "Bilinmeyen hata" });
    }
  }

  return fail("Bilinmeyen işlem.", 400);
}

export const Route = createFileRoute("/api/mmpi")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handle(request);
        } catch (error) {
          console.error("[api/mmpi]", error);
          return fail(error instanceof Error ? error.message : "Sunucu hatası", 500);
        }
      },
    },
  },
});
