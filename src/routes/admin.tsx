import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandHeader } from "@/components/mmpi/BrandHeader";
import { ResultsView, type ResultParticipant } from "@/components/mmpi/ResultsView";
import { api, type AdminSessionRow } from "@/lib/api";
import { formatDuration, genderLabel, type MmpiResults } from "@/lib/mmpi-scoring";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Yönetim Paneli — Pruva MMPI Testi" },
      { name: "description", content: "MMPI test katılımcılarının bilgileri, puan durumu ve PDF raporlarının listelendiği yönetim paneli." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Yönetim Paneli — Pruva MMPI Testi" },
      { property: "og:description", content: "MMPI katılımcı kayıtları ve rapor indirme paneli." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type SessionRow = {
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
  results: unknown;
};

const STORE_KEY = "pruva-admin-cred";

function fmt(value: string | null): string {
  return value ? new Date(value).toLocaleString("tr-TR") : "-";
}

function statusLabel(status: string): string {
  if (status === "completed") return "Tamamlandı";
  if (status === "abandoned") return "Terk edildi";
  return "Devam ediyor";
}

function AdminPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const [autoExport, setAutoExport] = useState(false);

  async function load(user: string, pass: string, auto = false) {
    if (!user.trim() || !pass) {
      setError("Kullanıcı adı ve şifre girilmeden giriş yapılamaz.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminSessions(user, pass);
      setRows(res.sessions as SessionRow[]);
      setAuthed(true);
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ user, pass }));
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const looksLikeValidation = raw.includes("too_small") || raw.includes("Required");
      if (looksLikeValidation) {
        setError("Kullanıcı adı ve şifre girilmeden giriş yapılamaz.");
      } else {
        setError(raw || "Giriş başarısız.");
      }
      if (!auto) setAuthed(false);
      sessionStorage.removeItem(STORE_KEY);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return;
    try {
      const { user, pass } = JSON.parse(raw) as { user: string; pass: string };
      if (!user.trim() || !pass) {
        sessionStorage.removeItem(STORE_KEY);
        return;
      }
      setUsername(user);
      setPassword(pass);
      void load(user, pass, true);
    } catch {
      sessionStorage.removeItem(STORE_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = rows.filter((row) => {
    if (!query.trim()) return true;
    const q = query.toLocaleLowerCase("tr-TR");
    return [row.full_name, row.email, row.phone].some((field) =>
      (field ?? "").toLocaleLowerCase("tr-TR").includes(q),
    );
  });

  function openReport(row: SessionRow, download: boolean) {
    setAutoExport(download);
    setSelected(row);
    if (!download) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
        <BrandHeader subtitle="Yönetim Paneli" />
        <form
          className="panel-surface space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void load(username, password);
          }}
        >
          <h1 className="text-xl font-semibold">Yönetici Girişi</h1>
          <div className="space-y-1.5">
            <Label htmlFor="admin-user">Kullanıcı adı</Label>
            <Input id="admin-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-pass">Şifre</Label>
            <Input
              id="admin-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full bg-brand-gradient text-primary-foreground hover:opacity-90">
            {loading ? "Kontrol ediliyor..." : "Giriş yap"}
          </Button>
        </form>
      </main>
    );
  }

  if (selected) {
    const results = selected.results as MmpiResults | null;
    const participant: ResultParticipant = {
      full_name: selected.full_name,
      age: selected.age,
      gender: selected.gender,
      phone: selected.phone,
      email: selected.email,
      duration_seconds: selected.duration_seconds ?? 0,
      started_at: fmt(selected.started_at),
      finished_at: fmt(selected.finished_at),
      leave_count: selected.leave_count ?? 0,
      ip_address: selected.ip_address,
      last_left_at: selected.last_left_at ? fmt(selected.last_left_at) : null,
      last_returned_at: selected.last_returned_at ? fmt(selected.last_returned_at) : null,
    };
    return (
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8">
        <Button variant="secondary" onClick={() => setSelected(null)}>
          ← Listeye dön
        </Button>
        {results ? (
          <ResultsView results={results} participant={participant} autoExport={autoExport} />
        ) : (
          <p className="panel-surface p-6 text-sm text-warning">
            Bu katılımcı testi tamamlamadığı için rapor verisi bulunmuyor.
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[100rem] space-y-5 px-4 py-8">
      <BrandHeader subtitle="Yönetim Paneli" />

      <div className="panel-surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Ad, e-posta veya telefon ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-72"
          />
          <span className="text-sm text-muted-foreground">
            {filtered.length} / {rows.length} kayıt
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={loading} onClick={() => void load(username, password, true)}>
            {loading ? "Yenileniyor..." : "Yenile"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              sessionStorage.removeItem(STORE_KEY);
              setAuthed(false);
              setPassword("");
              setRows([]);
            }}
          >
            Çıkış
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="panel-surface overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3 text-left">Ad Soyad</th>
                <th className="px-3 py-3 text-right">Yaş</th>
                <th className="px-3 py-3 text-left">Cinsiyet</th>
                <th className="px-3 py-3 text-left">Telefon</th>
                <th className="px-3 py-3 text-left">E-posta</th>
                <th className="px-3 py-3 text-left">Durum</th>
                <th className="px-3 py-3 text-right">Cevap</th>
                <th className="px-3 py-3 text-left">Puan durumu</th>
                <th className="px-3 py-3 text-right">Süre</th>
                <th className="px-3 py-3 text-left">Başlangıç</th>
                <th className="px-3 py-3 text-left">Bitiş</th>
                <th className="px-3 py-3 text-right">Terk</th>
                <th className="px-3 py-3 text-left">IP</th>
                <th className="px-3 py-3 text-left">Rapor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const results = row.results as MmpiResults | null;
                const high = results?.highScales ?? [];
                return (
                  <tr key={row.id} className="border-t border-border/60 align-middle">
                    <td className="px-3 py-3 font-semibold">{row.full_name}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.age}</td>
                    <td className="px-3 py-3">{genderLabel(row.gender)}</td>
                    <td className="px-3 py-3 tabular-nums">{row.phone}</td>
                    <td className="px-3 py-3">{row.email}</td>
                    <td className="px-3 py-3">{statusLabel(row.status)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.answered_count ?? 0}/566</td>
                    <td className="max-w-[16rem] px-3 py-3 text-xs">
                      {results ? (
                        high.length ? (
                          <span className="text-destructive">Yüksek: {high.join(", ")}</span>
                        ) : (
                          <span className="text-success">Normal aralık</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">Puan yok</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.duration_seconds ? formatDuration(row.duration_seconds) : "-"}
                    </td>
                    <td className="px-3 py-3 text-xs">{fmt(row.started_at)}</td>
                    <td className="px-3 py-3 text-xs">{fmt(row.finished_at)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.leave_count ?? 0}
                      {row.last_question ? ` (s.${row.last_question})` : ""}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{row.ip_address ?? "-"}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!results}
                          className="bg-brand-gradient text-primary-foreground hover:opacity-90"
                          onClick={() => openReport(row, true)}
                        >
                          PDF indir
                        </Button>
                        <Button size="sm" variant="secondary" disabled={!results} onClick={() => openReport(row, false)}>
                          Görüntüle
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
