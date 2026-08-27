import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandHeader } from "@/components/mmpi/BrandHeader";
import { RegistrationForm, type RegistrationValues } from "@/components/mmpi/RegistrationForm";
import { TestRunner, PAGE_SIZE } from "@/components/mmpi/TestRunner";
import { ResultsView, type ResultParticipant } from "@/components/mmpi/ResultsView";
import { api, type SessionParticipant } from "@/lib/api";
import { buildResultEmailHtml } from "@/lib/mmpi-email";
import {
  computeResults,
  formatDuration,
  type AnswerMap,
  type AnswerValue,
  type Gender,
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
  const [phase, setPhase] = useState<Phase>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<SessionParticipant | null>(null);
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
        const session = await api.getSession(saved);
        if (!session) {
          window.localStorage.removeItem(TOKEN_KEY);
          setPhase("register");
          return;
        }
        setToken(session.token);
        setProfile(session.participant);
        setAnswers(session.answers);
        setElapsed(session.durationSeconds ?? 0);
        setStartPage(Math.max(1, Math.ceil((session.lastQuestion || 1) / PAGE_SIZE)));
        if (session.status === "completed" && session.results) {
          setResults(session.results);
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
  }, []);


  // Sayaç
  useEffect(() => {
    if (!timerActive) return;
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerActive]);

  // Sayfa terk / dönüş takibi
  useEffect(() => {
    if (phase !== "test") return;
    function report(eventType: "left_page" | "returned_page") {
      const current = tokenRef.current;
      if (!current) return;
      void api
        .logEvent({
          token: current,
          eventType,
          elapsedSeconds: elapsedRef.current,
          questionNo: lastQuestionRef.current,
        })
        .catch(() => undefined);
    }
    function handleVisibility() {
      report(document.hidden ? "left_page" : "returned_page");
    }
    function handleLeave() {
      report("left_page");
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handleLeave);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handleLeave);
    };
  }, [phase]);

  const handleRegister = useCallback(async (values: RegistrationValues) => {
    setBusy(true);
    setError(null);
    try {
      const { token: fresh } = await api.startSession(values);
      window.localStorage.setItem(TOKEN_KEY, fresh);
      setToken(fresh);
      setProfile({
        full_name: values.fullName,
        age: values.age,
        gender: values.gender as Gender,
        phone: values.phone,
        email: values.email,
      });
      setAnswers({});
      setElapsed(0);
      setStartPage(1);
      setPhase("test");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test başlatılamadı, tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleAnswer = useCallback(
    (questionNo: number, answer: AnswerValue) => {
      if (answers[questionNo]) return;
      setAnswers((prev) => ({ ...prev, [questionNo]: answer }));
      lastQuestionRef.current = questionNo;
      const current = tokenRef.current;
      if (!current) return;
      void api
        .saveAnswer({
          token: current,
          questionNo,
          answer,
          elapsedSeconds: elapsedRef.current,
          lastQuestion: questionNo,
        })
        .catch(() => undefined);
    },
    [answers],
  );


  const handleFinish = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      // Puanlama tarayıcıda hesaplanır; sunucu yalnızca kaydeder ve e-posta gönderir.
      const computed = computeResults(answers, (profile?.gender ?? "male") as Gender);
      const { participant: info } = await api.finishSession({
        token,
        elapsedSeconds: elapsed,
        results: computed,
      });
      setResults(computed);
      setParticipant(info);
      setPhase("results");

      const subject = `MMPI Test Sonucu — ${info.full_name}`;
      try {
        const status = await api.sendResultEmails({
          token,
          subject,
          participantHtml: buildResultEmailHtml(info, computed, false),
          adminHtml: buildResultEmailHtml(info, computed, true),
        });
        setEmailStatus(status);
      } catch (mailError) {
        setEmailStatus({
          sent: false,
          error: mailError instanceof Error ? mailError.message : "E-posta gönderilemedi.",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sonuçlar hesaplanamadı.");
    } finally {
      setBusy(false);
    }
  }, [answers, elapsed, profile, token]);

  const handleRestart = useCallback(async () => {
    if (!token) {
      window.localStorage.removeItem(TOKEN_KEY);
      setPhase("register");
      return;
    }
    setBusy(true);
    try {
      const { token: fresh } = await api.restartSession(token);
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
  }, [token]);


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
