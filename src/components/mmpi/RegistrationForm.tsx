import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TOTAL_QUESTIONS } from "@/lib/mmpi-scoring";

export interface RegistrationValues {
  fullName: string;
  age: number;
  gender: "male" | "female";
  phone: string;
  email: string;
}

export function RegistrationForm({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (values: RegistrationValues) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const ageNumber = Number(age);
    if (fullName.trim().length < 3) return setLocalError("Ad soyad en az 3 karakter olmalı.");
    if (!Number.isFinite(ageNumber) || ageNumber < 16 || ageNumber > 99)
      return setLocalError("Yaş 16 ile 99 arasında olmalı.");
    if (!gender) return setLocalError("Cinsiyet seçmelisiniz.");
    if (phone.trim().length < 10) return setLocalError("Geçerli bir telefon numarası girin.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setLocalError("Geçerli bir e-posta adresi girin.");
    setLocalError(null);
    onSubmit({ fullName: fullName.trim(), age: ageNumber, gender, phone: phone.trim(), email: email.trim() });
  }

  const shown = localError ?? error;

  return (
    <div className="panel-surface p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Teste Başlamadan Önce</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Sonuç raporunuzun size ulaşabilmesi için aşağıdaki bilgileri eksiksiz doldurun. Bilgiler
        girilmeden test başlatılamaz. Test {TOTAL_QUESTIONS} sorudan oluşur, süre otomatik olarak
        kayıt edilir ve verdiğiniz cevaplar sonradan değiştirilemez.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="fullName">Ad Soyad</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Adınız ve soyadınız" autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="age">Yaş</Label>
          <Input id="age" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Örn. 28" />
        </div>
        <div className="space-y-2">
          <Label>Cinsiyet</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["female", "male"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setGender(value)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  gender === value
                    ? "border-transparent bg-brand-gradient text-primary-foreground"
                    : "border-border bg-secondary/40 text-foreground hover:bg-secondary"
                }`}
              >
                {value === "female" ? "Kadın" : "Erkek"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" autoComplete="tel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-posta</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@mail.com" autoComplete="email" />
        </div>

        {shown ? (
          <p className="sm:col-span-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {shown}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <Button type="submit" disabled={submitting} size="lg" className="w-full bg-brand-gradient text-primary-foreground hover:opacity-90 sm:w-auto">
            {submitting ? "Hazırlanıyor..." : "Teste Başla"}
          </Button>
        </div>
      </form>
    </div>
  );
}
