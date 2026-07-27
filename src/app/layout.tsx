import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { DemoInit } from "@/components/demo/DemoInit";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face — used with restraint for headlines and the landing page.
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Prism — Run AI locally, with retrieval you can measure",
    template: "%s — Prism",
  },
  description:
    "A privacy-first hub for local language models. Hybrid retrieval over your own documents, built-in evaluation metrics, and zero cloud calls.",
  applicationName: "Prism",
  keywords: [
    "local LLM", "RAG", "hybrid retrieval", "BM25", "Ollama",
    "privacy-first AI", "self-hosted", "vector search", "RAG evaluation",
  ],
  openGraph: {
    title: "Prism — Run AI locally, with retrieval you can measure",
    description:
      "Hybrid retrieval over your own documents, built-in evaluation metrics, and zero cloud calls.",
    type: "website",
    siteName: "Prism",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prism — Run AI locally, with retrieval you can measure",
    description:
      "Hybrid retrieval over your own documents, built-in evaluation metrics, and zero cloud calls.",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full`}
    >
      <body className="h-full bg-[var(--color-background)] text-[var(--color-foreground)] antialiased">
        <DemoInit />
        {children}
      </body>
    </html>
  );
}
