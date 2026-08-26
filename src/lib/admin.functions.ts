import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const credentialsSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env["ADMIN_PANEL_USER"] ?? "admin";
  const expectedPass = process.env["ADMIN_PANEL_PASSWORD"] ?? "@pruvapsikoloji.com";
  return username === expectedUser && password === expectedPass;
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => credentialsSchema.parse(data))
  .handler(async ({ data }) => {
    if (!checkCredentials(data.username, data.password)) {
      throw new Error("Kullanıcı adı veya şifre hatalı.");
    }
    return { ok: true as const };
  });

export const adminSessions = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => credentialsSchema.parse(data))
  .handler(async ({ data }) => {
    if (!checkCredentials(data.username, data.password)) {
      throw new Error("Yetkisiz erişim.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sessions, error } = await supabaseAdmin
      .from("test_sessions")
      .select(
        "id, full_name, age, gender, phone, email, ip_address, status, started_at, finished_at, duration_seconds, answered_count, last_question, leave_count, last_left_at, last_returned_at, email_sent_at, results",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { sessions: sessions ?? [] };
  });
