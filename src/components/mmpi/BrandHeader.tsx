const LOGO_URL = "/__l5e/assets-v1/f98e08a3-a737-456f-9b33-f497ed1b4e6d/puma-logo.png";

export function BrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <img src={LOGO_URL} alt="Pruva logo" className="h-11 w-auto" />
        <div>
          <p className="text-lg font-semibold tracking-tight text-brand-gradient">
            MMPI Kişilik Envanteri
          </p>
          <p className="text-xs text-muted-foreground">
            {subtitle ?? "566 soruluk Minnesota Çok Yönlü Kişilik Envanteri"}
          </p>
        </div>
      </div>
      <div className="hidden h-1.5 w-40 rounded-full bg-brand-gradient sm:block" />
    </header>
  );
}

export { LOGO_URL };
