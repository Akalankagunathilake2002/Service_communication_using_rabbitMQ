import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RabbitMQ Service Communication Dashboard",
  description: "Live dashboard for the order/inventory/notification RabbitMQ demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
