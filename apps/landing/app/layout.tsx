import type { Metadata } from "next";
import { Sora, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import SmoothScrollProvider from "@/components/SmoothScrollProvider";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "BuilderOS — The AI-Native Operating System for Web3 Builders",
  description:
    "BuilderOS discovers grants, hackathons, and funding opportunities, helps you prepare stronger applications, and turns your shipped work into verifiable on-chain reputation — through a coordinated system of specialized AI agents.",
  metadataBase: new URL("https://builderos.dev"),
  openGraph: {
    title: "BuilderOS: The AI-Native Operating System for Web3 Builders",
    description:
      "Discover. Apply. Prove. Build reputation. A coordinated system of AI agents for Web3 builders.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="bg-ink text-paper antialiased selection:bg-brass selection:text-ink">
        <a
          href="#hero"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-sm focus:bg-brass focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:text-ink"
        >
          Skip to content
        </a>
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
