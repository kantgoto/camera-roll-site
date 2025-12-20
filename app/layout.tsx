// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Cinzel_Decorative } from "next/font/google";

const cinzelDecorative = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-cinzel-decorative",
});

export const metadata: Metadata = {
  title: "カメラロール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={cinzelDecorative.variable}>{children}</body>
    </html>
  );
}
