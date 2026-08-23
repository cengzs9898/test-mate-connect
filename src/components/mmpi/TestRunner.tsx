import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MMPI_QUESTIONS } from "@/data/mmpi-questions";
import { formatDuration, type AnswerMap, type AnswerValue } from "@/lib/mmpi-scoring";

const PAGE_SIZE = 20;

export function TestRunner({
  answers,
  elapsed,
  onAnswer,
  onFinish,
  finishing,
  startPage,
}: {
  answers: AnswerMap;
  elapsed: number;
  onAnswer: (questionNo: number, answer: AnswerValue) => void;
  onFinish: () => void;
  finishing: boolean;
  startPage: number;
}) {
  const totalPages = Math.ceil(MMPI_QUESTIONS.length / PAGE_SIZE);
  const [page, setPage] = useState(Math.min(Math.max(startPage, 1), totalPages));
  const topRef = useRef<HTMLDivElement | null>(null);

  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / MMPI_QUESTIONS.length) * 100;

  const items = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return MMPI_QUESTIONS.slice(start, start + PAGE_SIZE).map((text, index) => ({
      no: start + index + 1,
      text,
    }));
  }, [page]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  const pageComplete = items.every((item) => answers[item.no]);

  return (
    <div className="space-y-5" ref={topRef}>
      <div className="panel-surface sticky top-2 z-10 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              Sayfa {page} / {totalPages}
            </p>
            <p className="text-xs text-muted-foreground">
              {answeredCount} / {MMPI_QUESTIONS.length} soru cevaplandı
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm font-semibold tabular-nums">
              ⏱ {formatDuration(elapsed)}
            </div>
            <Button
              disabled={finishing}
              onClick={onFinish}
              size="sm"
              className="bg-brand-gradient text-primary-foreground hover:opacity-90"
            >
              {finishing ? "Hesaplanıyor..." : "Testi Bitir"}
            </Button>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ol className="space-y-3">
        {items.map((item) => {
          const value = answers[item.no];
          const locked = Boolean(value);
          return (
            <li
              key={item.no}
              className={`rounded-2xl border p-4 transition-colors ${
                locked ? "border-border/60 bg-card/60" : "border-border bg-card"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-relaxed sm:text-base">
                  <span className="mr-2 inline-flex min-w-9 justify-center rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {item.no}
                  </span>
                  {item.text}
                </p>
                <div className="flex shrink-0 gap-2">
                  {(["D", "Y"] as const).map((option) => {
                    const active = value === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={locked}
                        onClick={() => onAnswer(item.no, option)}
                        className={`min-w-24 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                          active
                            ? option === "D"
                              ? "border-transparent bg-brand-gradient text-primary-foreground"
                              : "border-transparent bg-secondary text-foreground ring-1 ring-border"
                            : "border-border bg-secondary/30 hover:bg-secondary"
                        } ${locked && !active ? "opacity-35" : ""} ${locked ? "cursor-not-allowed" : ""}`}
                      >
                        {option === "D" ? "Doğru" : "Yanlış"}
                      </button>
                    );
                  })}
                </div>
              </div>
              {locked ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  🔒 Cevap kaydedildi ve değiştirilemez.
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="panel-surface flex flex-wrap items-center justify-between gap-3 p-4">
        <Button variant="secondary" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          ← Önceki sayfa
        </Button>
        <p className="text-xs text-muted-foreground">
          {pageComplete ? "Bu sayfa tamamlandı." : "Devam etmek için bu sayfadaki tüm soruları cevaplayın."}
        </p>
        {page < totalPages ? (
          <Button
            disabled={!pageComplete}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="bg-brand-gradient text-primary-foreground hover:opacity-90"
          >
            Sonraki sayfa →
          </Button>
        ) : (
          <Button
            disabled={!allAnswered || finishing}
            onClick={onFinish}
            className="bg-brand-gradient text-primary-foreground hover:opacity-90"
          >
            {finishing ? "Sonuçlar hesaplanıyor..." : "Testi Bitir ve Raporu Gönder"}
          </Button>
        )}
      </div>
    </div>
  );
}

export { PAGE_SIZE };
