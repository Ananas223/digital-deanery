export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
        Учебный концепт для конкурса
      </p>
      <h1 className="text-3xl font-semibold text-balance sm:text-4xl">Цифровой деканат будущего</h1>
      <p className="max-w-prose text-muted-foreground">
        Каркас приложения готов. Разделы кабинета появятся на следующих этапах плана разработки.
      </p>
    </main>
  );
}
