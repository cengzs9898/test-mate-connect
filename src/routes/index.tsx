import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { BrandHeader } from "@/components/mmpi/BrandHeader";
import { RegistrationForm, type RegistrationValues } from "@/components/mmpi/RegistrationForm";
import { TestRunner, PAGE_SIZE } from "@/components/mmpi/TestRunner";
import { ResultsView, type ResultParticipant } from "@/components/mmpi/ResultsView";
import {
  finishSession,
  getSession,
  logEvent,
  restartSession,
  saveAnswer,
  startSession,
} from "@/lib/mmpi.functions";
import {
  formatDuration,
  type AnswerMap,
  type AnswerValue,
  type MmpiResults,
} from "@/lib/mmpi-scoring";

const TOKEN_KEY = "mmpi_session_token";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MMPI Kişilik Envanteri | Pruva Psikoloji" },
      {
        name: "description",
        content:
          "566 soruluk MMPI kişilik envanterini çevrimiçi çözün; süre takibi, kilitli cevaplar ve ayrıntılı T-puanı raporu e-posta ve PDF olarak.",
      },
      { property: "og:title", content: "MMPI Kişilik Envanteri | Pruva Psikoloji" },
      {
        property: "og:description",
        content: "566 soruluk MMPI envanteri, ayrıntılı T-puanı raporu, PDF ve e-posta çıktısı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Phase = "loading" | "register" | "resume" | "test" | "results";

function Index() {
  const start = useServerFn(startSession);
  const load = useServerFn(getSession);
  const persistAnswer = useServerFn(saveAnswer);
  const track = useServerFn(logEvent);
  const restart = useServerFn(restartSession);
  const finish = useServerFn(finishSession);

  const [phase, setPhase] = useState<Phase>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [elapsed, setElapsed] = useState(0);
  const [startPage, setStartPage] = useState(1);
  const [participant, setParticipant] = useState<ResultParticipant | null>(null);
  const [results, setResults] = useState<MmpiResults | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; error?: string }>({ sent: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resumeInfo, setResumeInfo] = useState<{ name: string; answered: number; seconds: number } | null>(null);

  const timerActive = phase === "test";
  const lastQuestionRef = useRef(1);
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  // Kaydedilmiş oturumu geri yükle
  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY);
    if (!saved) {
      setPhase("register");
      return;
    }
    void (async () => {
      try {
        const session = await load({ data: { token: saved } });
        if (!session) {
          window.localStorage.removeItem(TOKEN_KEY);
          setPhase("register");
          return;
        }
        setToken(session.token);
        setAnswers(session.answers);
        setElapsed(session.durationSeconds ?? 0);
        setStartPage(Math.max(1, Math.ceil((session.lastQuestion || 1) / PAGE_SIZE)));
        if (session.status === "completed" && session.results) {
          setResults(session.results as unknown as MmpiResults);
          setParticipant({
            ...session.participant,
            duration_seconds: session.durationSeconds ?? 0,
            started_at: session.startedAt,
            finished_at: session.finishedAt,
            leave_count: session.leaveCount,
            last_left_at: session.lastLeftAt,
            last_returned_at: session.lastReturnedAt,
          });
          setEmailStatus({ sent: true });
          setPhase("results");
          return;
        }
        setResumeInfo({
          name: session.participant.full_name,
          answered: Object.keys(session.answers).length,
          seconds: session.durationSeconds ?? 0,
        });
        setPhase("resume");
      } catch {
        window.localStorage.removeItem(TOKEN_KEY);
        setPhase("register");
      }
    })();
  }, [load]);

  // Sayaç
  useEffect(() => {
    if (!timerActive) return;
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerActive]);

  // Sayfa terk / dönüş takibi
  useEffect(() => {
    if (phase !== "test") return;
    function handleVisibility() {
      const current = tokenRef.current;
      if (!current) return;
      void track({
        data: {
          token: current,
          eventType: document.hidden ? "left_page" : "returned_page",
          elapsedSeconds: elapsedRef.current,
          questionNo: lastQuestionRef.current,
        },
      }).catch(() => undefined);
    }
    function handleLeave() {
      const current = tokenRef.current;
      if (!current) return;
      void track({
        data: {
          token: current,
          eventType: "left_page",
          elapsedSeconds: elapsedRef.current,
          questionNo: lastQuestionRef.current,
        },
      }).catch(() => undefined);
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handleLeave);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handleLeave);
    };
  }, [phase, track]);

  const handleRegister = useCallback(
    async (values: RegistrationValues) => {
      setBusy(true);
      setError(null);
      try {
        const { token: fresh } = await start({ data: values });
        window.localStorage.setItem(TOKEN_KEY, fresh);
        setToken(fresh);
        setAnswers({});
        setElapsed(0);
        setStartPage(1);
        setPhase("test");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Test başlatılamadı, tekrar deneyin.");
      } finally {
        setBusy(false);
      }
    },
    [start],
  );

  const handleAnswer = useCallback(
    (questionNo: number, answer: AnswerValue) => {
      if (answers[questionNo]) return;
      setAnswers((prev) => ({ ...prev, [questionNo]: answer }));
      lastQuestionRef.current = questionNo;
      const current = tokenRef.current;
      if (!current) return;
      void persistAnswer({
        data: {
          token: current,
          questionNo,
          answer,
          elapsedSeconds: elapsedRef.current,
          lastQuestion: questionNo,
        },
      }).catch(() => undefined);
    },
    [answers, persistAnswer],
  );

  const handleFinish = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const output = await finish({ data: { token, elapsedSeconds: elapsed } });
      setResults(output.results);
      setParticipant(output.participant);
      setEmailStatus(output.emailStatus);
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sonuçlar hesaplanamadı.");
    } finally {
      setBusy(false);
    }
  }, [elapsed, finish, token]);

  const handleRestart = useCallback(async () => {
    if (!token) {
      window.localStorage.removeItem(TOKEN_KEY);
      setPhase("register");
      return;
    }
    setBusy(true);
    try {
      const { token: fresh } = await restart({ data: { token } });
      window.localStorage.setItem(TOKEN_KEY, fresh);
      setToken(fresh);
      setAnswers({});
      setElapsed(0);
      setStartPage(1);
      setResults(null);
      setPhase("test");
    } catch {
      window.localStorage.removeItem(TOKEN_KEY);
      setPhase("register");
    } finally {
      setBusy(false);
    }
  }, [restart, token]);

  const handleResume = useCallback(() => {
    if (token) {
      void api
        .logEvent({ token, eventType: "test_resumed", elapsedSeconds: elapsed })
        .catch(() => undefined);
    }
    setPhase("test");
  }, [elapsed, token]);


  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <BrandHeader />

      {phase === "loading" ? (
        <div className="panel-surface p-8 text-sm text-muted-foreground">Yükleniyor...</div>
      ) : null}

      {phase === "register" ? (
        <RegistrationForm onSubmit={handleRegister} submitting={busy} error={error} />
      ) : null}

      {phase === "resume" && resumeInfo ? (
        <div className="panel-surface p-6 sm:p-8">
          <h1 className="text-2xl font-semibold">Tekrar hoş geldiniz, {resumeInfo.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Yarım kalmış bir testiniz var: {resumeInfo.answered} soru cevaplandı, geçen süre{" "}
            {formatDuration(resumeInfo.seconds)}. Kaldığınız yerden devam edebilir veya testi
            baştan başlatabilirsiniz.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={handleResume} className="bg-brand-gradient text-primary-foreground hover:opacity-90">
              Devam et
            </Button>
            <Button variant="secondary" onClick={handleRestart} disabled={busy}>
              Teste yeniden başla
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "test" ? (
        <>
          {error ? (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <TestRunner
            answers={answers}
            elapsed={elapsed}
            onAnswer={handleAnswer}
            onFinish={handleFinish}
            finishing={busy}
            startPage={startPage}
          />
        </>
      ) : null}

      {phase === "results" && results && participant ? (
        <ResultsView
          results={results}
          participant={participant}
          emailStatus={emailStatus}
          onRestart={handleRestart}
        />
      ) : null}
    </main>
  );
}
