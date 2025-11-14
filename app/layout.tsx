import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Face Lifting Editor - AI-Powered Portrait Editor",
  description: "Edit and enhance your portrait photos with AI-powered face lifting features",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
