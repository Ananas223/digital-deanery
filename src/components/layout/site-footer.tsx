/** Постоянная пометка о конкурсном концепте (`AGENTS.md` § 4.3, PRD § 8.6). */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background px-4 py-4 md:px-6">
      <p className="mx-auto w-full max-w-6xl text-xs text-muted-foreground">
        Учебный концепт для конкурса. Не официальный сервис вуза.
      </p>
    </footer>
  );
}
