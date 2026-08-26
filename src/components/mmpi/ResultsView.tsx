import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDuration, genderLabel, type MmpiResults, type ScaleResult } from "@/lib/mmpi-scoring";
import { BrandHeader } from "./BrandHeader";

export interface ResultParticipant {
  full_name: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  duration_seconds: number;
  started_at: string;
  finished_at: string;
  leave_count: number;
  ip_address?: string | null;
  last_left_at?: string | null;
  last_returned_at?: string | null;
}

function levelColor(level: ScaleResult["level"]) {
  if (level === "high") return "text-destructive";
  if (level === "low") return "text-warning";
  return "text-success";
}

function ScaleBars({ title, scales }: { title: string; scales: ScaleResult[] }) {
  return (
    <section className="panel-surface p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-4 space-y-2.5">
        {scales.map((scale) => (
          <div key={scale.code + scale.name} className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground">{scale.name}</span>
            <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-brand-gradient"
                style={{ width: `${Math.min(100, (scale.tScore / 120) * 100)}%` }}
              />
            </div>
            <span className={`text-right text-xs font-semibold tabular-nums ${levelColor(scale.level)}`}>
              {scale.tScore}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScaleTable({ title, scales }: { title: string; scales: ScaleResult[] }) {
  return (
    <section className="panel-surface overflow-hidden p-0">
      <h3 className="border-b border-border px-5 py-4 text-lg font-semibold">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Ölçek</th>
              <th className="px-4 py-2 text-left">Açıklama</th>
              <th className="px-4 py-2 text-right">Ham</th>
              <th className="px-4 py-2 text-right">K Düz.</th>
              <th className="px-4 py-2 text-right">T Puan</th>
              <th className="px-4 py-2 text-left">Düzey</th>
            </tr>
          </thead>
          <tbody>
            {scales.map((scale) => (
              <tr key={scale.code + scale.name} className="border-t border-border/60">
                <td className="px-4 py-2 font-semibold">{scale.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{scale.desc}</td>
                <td className="px-4 py-2 text-right tabular-nums">{scale.rawScore}</td>
                <td className="px-4 py-2 text-right tabular-nums">{scale.kCorrection || "-"}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">{scale.tScore}</td>
                <td className={`px-4 py-2 font-medium ${levelColor(scale.level)}`}>{scale.levelLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ResultsView({
  results,
  participant,
  emailStatus,
  onRestart,
  autoExport = false,
}: {
  results: MmpiResults;
  participant: ResultParticipant;
  emailStatus?: { sent: boolean; error?: string };
  onRestart?: () => void;
  autoExport?: boolean;
}) {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const autoDone = useRef(false);


  async function exportPdf() {
    if (!reportRef.current) return;
    setExporting(true);
    setPdfError(null);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas-pro"),
      ]);
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#141d2e",
        scale: 2,
        useCORS: true,
      });
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      const image = canvas.toDataURL("image/jpeg", 0.92);
      let remaining = imgHeight;
      let offset = 0;
      while (remaining > 0) {
        pdf.addImage(image, "JPEG", 0, -offset, pageWidth, imgHeight);
        remaining -= pageHeight;
        offset += pageHeight;
        if (remaining > 0) pdf.addPage();
      }
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const slug = participant.full_name
        .toLocaleLowerCase("tr-TR")
        .replace(/ş/g, "s").replace(/ı/g, "i").replace(/ğ/g, "g")
        .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const fileName = `${slug}-${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}-${pad(now.getHours())}.${pad(now.getMinutes())}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error("PDF export failed", err);
      setPdfError(err instanceof Error ? err.message : "PDF oluşturulamadı.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="panel-surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          {emailStatus.sent ? (
            <span className="text-success">
              ✓ Rapor {participant.email} adresine ve yönetim adresine gönderildi.
            </span>
          ) : (
            <span className="text-warning">
              ⚠ Rapor e-postası gönderilemedi{emailStatus.error ? `: ${emailStatus.error}` : ""}. Raporu
              PDF olarak indirebilirsiniz.
            </span>
          )}
        </div>
        {pdfError ? <p className="w-full text-xs text-destructive">PDF hatası: {pdfError}</p> : null}
        <div className="flex gap-2">
          <Button onClick={exportPdf} disabled={exporting} className="bg-brand-gradient text-primary-foreground hover:opacity-90">
            {exporting ? "PDF hazırlanıyor..." : "PDF olarak kaydet"}
          </Button>
          <Button variant="secondary" onClick={onRestart}>
            Yeni test
          </Button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-5 rounded-2xl bg-background p-4">
        <BrandHeader subtitle="MMPI Sonuç Raporu" />

        <section className="panel-surface p-5">
          <h2 className="text-xl font-semibold">{participant.full_name}</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            {[
              ["Yaş", String(participant.age)],
              ["Cinsiyet", genderLabel(participant.gender)],
              ["Telefon", participant.phone],
              ["E-posta", participant.email],
              ["Başlangıç", participant.started_at],
              ["Bitiş", participant.finished_at],
              ["Süre", formatDuration(participant.duration_seconds)],
              ["Cevaplanan", `${results.answered} / ${results.answered + results.unanswered}`],
              ["Sayfa terk sayısı", String(participant.leave_count ?? 0)],
              ["Son terk saati", participant.last_left_at || "Terk edilmedi"],
              ["Geri dönüş saati", participant.last_returned_at || "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border/70 bg-secondary/30 px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {results.validityWarning ? (
          <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            {results.validityWarning}
          </p>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <ScaleBars title="Klinik Ölçekler (T Puanları)" scales={results.clinical} />
          <ScaleBars title="İçerik Ölçekleri (T Puanları)" scales={results.content} />
        </div>

        <ScaleTable title="Klinik Ölçek Tablosu" scales={results.clinical} />
        <ScaleTable title="İçerik Ölçek Tablosu" scales={results.content} />

        <section className="panel-surface p-5">
          <h3 className="text-lg font-semibold">Genel Değerlendirme</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{results.plainSummary}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{results.overallSummary}</p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Ayrıntılı Ölçek Yorumları</h3>
          {[...results.clinical, ...results.content].map((scale) => (
            <article key={`detail-${scale.code}-${scale.name}`} className="panel-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold">
                  {scale.name} — {scale.title || scale.desc}
                </h4>
                <span className={`text-sm font-semibold ${levelColor(scale.level)}`}>
                  T: {scale.tScore} · {scale.levelLabel}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{scale.interpretation}</p>
            </article>
          ))}
        </section>

        <p className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
          Not: Bu rapor bir ön değerlendirmedir ve tıbbi teşhis niteliği taşımaz. Sonuçların
          yorumlanması yetkin bir ruh sağlığı uzmanı tarafından yapılmalıdır.
        </p>
      </div>
    </div>
  );
}
