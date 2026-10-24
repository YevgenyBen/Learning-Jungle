import type { Metadata, Viewport } from "next";
import { Assistant, Secular_One } from "next/font/google";
import type { ReactNode } from "react";
import { RotateScreen } from "@/shell/RotateScreen";
import "./globals.css";

const display = Secular_One({
  weight: "400",
  subsets: ["hebrew", "latin"],
  variable: "--font-secular-one",
  display: "swap",
});

const body = Assistant({
  weight: ["400", "600", "700"],
  subsets: ["hebrew", "latin"],
  variable: "--font-assistant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ג׳ונגל הלמידה",
  description: "משחקי לימוד בעברית ובחשבון לכיתה א׳",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e6f1ea",
};

// ADR-0003: Hebrew only, right-to-left everywhere.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <RotateScreen />
      </body>
    </html>
  );
}
