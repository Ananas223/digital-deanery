import type { Metadata } from "next";

import { THEME_BOOTSTRAP } from "@/components/theme/theme-bootstrap";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Деканат будущего",
  title: {
    default: "Деканат будущего",
    template: "%s — Деканат будущего",
  },
  description:
    "Учебный концепт личного кабинета студента, созданный для конкурса. Не официальный сервис вуза.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <link
          rel="preload"
          href="/fonts/onest/onest-cyrillic-400-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/onest/onest-latin-400-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
