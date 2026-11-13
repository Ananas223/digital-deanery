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
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
