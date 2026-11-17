/** First keyboard destination on every authenticated page. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:flex focus:min-h-11 focus:items-center focus:rounded-lg focus:border focus:border-primary focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline-2 focus:outline-offset-2 focus:outline-ring"
    >
      К содержанию
    </a>
  );
}
