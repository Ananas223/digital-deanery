import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Цифровой деканат будущего",
  title: {
    default: "Цифровой деканат будущего",
    template: "%s — Цифровой деканат будущего",
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
    <html lang="ru">
      <head>
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
        {children}
      </body>
    </html>
  );
}
