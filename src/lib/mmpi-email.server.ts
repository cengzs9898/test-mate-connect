import type { MmpiResults, ScaleResult } from "./mmpi-scoring";
import { formatDuration, genderLabel } from "./mmpi-scoring";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

export interface ParticipantInfo {
  full_name: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  ip_address?: string | null;
  duration_seconds: number;
  started_at: string;
  finished_at: string;
  leave_count: number;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scaleRows(results: ScaleResult[]): string {
  return results
    .map(
      (r) => `<tr>
        <td style="padding:6px 10px;border:1px solid #d7dee8;font-weight:600;">${esc(r.title)}</td>
        <td style="padding:6px 10px;border:1px solid #d7dee8;text-align:center;">${r.rawScore}</td>
        <td style="padding:6px 10px;border:1px solid #d7dee8;text-align:center;font-weight:700;color:${
          r.tScore >= 70 ? "#b42318" : r.tScore <= 40 ? "#0b6bcb" : "#1c7c54"
        };">${r.tScore}</td>
        <td style="padding:6px 10px;border:1px solid #d7dee8;text-align:center;">${esc(r.levelLabel)}</td>
        <td style="padding:6px 10px;border:1px solid #d7dee8;">${esc(r.interpretation)}</td>
      </tr>`,
    )
    .join("");
}

export function buildResultEmailHtml(
  participant: ParticipantInfo,
  results: MmpiResults,
  isCopyForAdmin: boolean,
): string {
  const header = `
    <div style="background:linear-gradient(100deg,#1a9be0,#8cc63f);padding:20px 24px;border-radius:12px;color:#ffffff;">
      <div style="font-size:20px;font-weight:700;">MMPI Kişilik Testi — Sonuç Raporu</div>
      <div style="font-size:13px;opacity:.9;">Minnesota Çok Yönlü Kişilik Envanteri</div>
    </div>`;

  const info = `
    <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:13px;">
      <tr><td style="padding:6px 10px;border:1px solid #d7dee8;width:180px;font-weight:600;">Ad Soyad</td><td style="padding:6px 10px;border:1px solid #d7dee8;">${esc(participant.full_name)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #d7dee8;font-weight:600;">Yaş / Cinsiyet</td><td style="padding:6px 10px;border:1px solid #d7dee8;">${participant.age} / ${esc(genderLabel(participant.gender))}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #d7dee8;font-weight:600;">E-posta</td><td style="padding:6px 10px;border:1px solid #d7dee8;">${esc(participant.email)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #d7dee8;font-weight:600;">Telefon</td><td style="padding:6px 10px;border:1px solid #d7dee8;">${esc(participant.phone)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #d7dee8;font-weight:600;">Test süresi</td><td style="padding:6px 10px;border:1px solid #d7dee8;">${esc(formatDuration(participant.duration_seconds))}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #d7dee8;font-weight:600;">Cevaplanan / Boş</td><td style="padding:6px 10px;border:1px solid #d7dee8;">${results.answered} / ${results.unanswered}</td></tr>
      ${
        isCopyForAdmin
          ? `<tr><td style="padding:6px 10px;border:1px solid #d7dee8;font-weight:600;">IP adresi</td><td style="padding:6px 10px;border:1px solid #d7dee8;">${esc(participant.ip_address ?? "-")}</td></tr>
             <tr><td style="padding:6px 10px;border:1px solid #d7dee8;font-weight:600;">Siteden ayrılma sayısı</td><td style="padding:6px 10px;border:1px solid #d7dee8;">${participant.leave_count}</td></tr>
             <tr><td style="padding:6px 10px;border:1px solid #d7dee8;font-weight:600;">Başlangıç / Bitiş</td><td style="padding:6px 10px;border:1px solid #d7dee8;">${esc(participant.started_at)} — ${esc(participant.finished_at)}</td></tr>`
          : ""
      }
    </table>`;

  const warning = results.validityWarning
    ? `<div style="margin-top:16px;padding:12px 14px;background:#fdecea;border:1px solid #f3b4ae;border-radius:8px;color:#8a1c13;font-size:13px;">${esc(results.validityWarning)}</div>`
    : "";

  const table = (title: string, rows: ScaleResult[]) => `
    <h3 style="margin:22px 0 8px;font-size:15px;color:#16324f;">${esc(title)}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr style="background:#eef3f9;">
        <th style="padding:6px 10px;border:1px solid #d7dee8;text-align:left;">Ölçek</th>
        <th style="padding:6px 10px;border:1px solid #d7dee8;">Ham</th>
        <th style="padding:6px 10px;border:1px solid #d7dee8;">T</th>
        <th style="padding:6px 10px;border:1px solid #d7dee8;">Düzey</th>
        <th style="padding:6px 10px;border:1px solid #d7dee8;text-align:left;">Yorum</th>
      </tr>
      ${scaleRows(rows)}
    </table>`;

  return `<!doctype html><html lang="tr"><body style="margin:0;padding:20px;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;color:#16324f;">
    <div style="max-width:820px;margin:0 auto;background:#ffffff;padding:24px;border-radius:14px;">
      ${header}
      ${info}
      ${warning}
      <h3 style="margin:22px 0 8px;font-size:15px;">Genel Değerlendirme</h3>
      <p style="font-size:13px;line-height:1.6;">${esc(results.overallSummary)}</p>
      <h3 style="margin:18px 0 8px;font-size:15px;">Sizin İçin Ne Anlama Geliyor?</h3>
      <p style="font-size:13px;line-height:1.6;">${esc(results.plainSummary)}</p>
      ${table("Klinik Ölçekler", results.clinical)}
      ${table("İçerik Ölçekleri", results.content)}
      <div style="margin-top:20px;padding:12px 14px;background:#fff6e6;border:1px solid #f0d3a0;border-radius:8px;font-size:12px;line-height:1.6;">
        <b>Not:</b> Bu analiz otomatik olarak üretilmiştir ve yalnızca bilgilendirme amaçlıdır. Kesin teşhis ve
        değerlendirme ancak yetkili bir klinik psikolog veya psikiyatrist tarafından yapılabilir. Sonuçlar tek
        başına tanı koymak için yeterli değildir.
      </div>
    </div>
  </body></html>`;
}

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRawEmail(to: string, subject: string, html: string): string {
  const encodedSubject = `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(subject)))}?=`;
  const message = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    btoa(String.fromCharCode(...new TextEncoder().encode(html))),
  ].join("\r\n");
  return base64UrlEncode(message);
}

export async function sendResultEmail(to: string, subject: string, html: string): Promise<void> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Gmail bağlantısı yapılandırılmamış (GOOGLE_MAIL_API_KEY eksik).");
  }

  const response = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: buildRawEmail(to, subject, html) }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Gmail gönderimi başarısız [${response.status}]: ${body}`);
    throw new Error(`Gmail gönderimi başarısız [${response.status}]: ${body}`);
  }
}
