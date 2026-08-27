import type { MmpiResults } from "./mmpi-scoring";
export { buildResultEmailHtml, type ParticipantInfo } from "./mmpi-email";
export type { MmpiResults };

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

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

/**
 * SMTP gönderimi (kendi sunucunuzda / Node ortamında çalışır).
 * Ortam değişkenleri:
 *   SMTP_HOST=srvc67.trwww.com
 *   SMTP_PORT=465
 *   SMTP_SECURE=true
 *   SMTP_USER=mmpitesti@pruvapsikoloji.com
 *   SMTP_PASS=********
 *   MAIL_FROM="Pruva MMPI <mmpitesti@pruvapsikoloji.com>"
 */
async function sendViaSmtp(to: string, subject: string, html: string): Promise<boolean> {
  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (!host || !user || !pass) return false;

  const port = Number(process.env["SMTP_PORT"] ?? "465");
  const secure = (process.env["SMTP_SECURE"] ?? (port === 465 ? "true" : "false")) === "true";
  const from = process.env["MAIL_FROM"] ?? `Pruva MMPI <${user}>`;

  // Dinamik specifier: bu modül serverless (Cloudflare) derlemesine dahil edilmez.
  const moduleName = "nodemailer";
  const nodemailer = (await import(/* @vite-ignore */ moduleName)) as typeof import("nodemailer");
  const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  await transport.sendMail({ from, to, subject, html });
  return true;
}

async function sendViaGmailGateway(to: string, subject: string, html: string): Promise<void> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error(
      "E-posta yapılandırması eksik: SMTP_HOST / SMTP_USER / SMTP_PASS tanımlayın (veya Gmail bağlantısı ekleyin).",
    );
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
    throw new Error(`E-posta gönderimi başarısız [${response.status}]: ${body}`);
  }
}

export async function sendResultEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    if (await sendViaSmtp(to, subject, html)) return;
  } catch (error) {
    console.error("SMTP gönderimi başarısız, yedek yönteme geçiliyor:", error);
  }
  await sendViaGmailGateway(to, subject, html);
}

