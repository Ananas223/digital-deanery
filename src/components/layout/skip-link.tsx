/** Ссылка «К содержанию»: первый элемент в порядке табуляции на каждой странице. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-popover focus:outline-2 focus:outline-offset-2 focus:outline-ring"
    >
      К содержанию
    </a>
  );
}
