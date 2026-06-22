import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AirTouch — Control Your PC With Hand Gestures",
  description:
    "An open-source, webcam-powered gesture controller for Windows. Move the cursor, click, drag, scroll, and adjust volume — all with your bare hands. Try the live in-browser demo.",
  keywords: [
    "gesture control",
    "hand tracking",
    "MediaPipe",
    "computer vision",
    "OpenCV",
    "touchless mouse",
    "air mouse",
    "webcam control",
  ],
  authors: [{ name: "AirTouch" }],
  openGraph: {
    title: "AirTouch — Control Your PC With Hand Gestures",
    description:
      "Webcam-powered gesture controller. Move, click, drag, scroll, and control volume with your bare hands.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
