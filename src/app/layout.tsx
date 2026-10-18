import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const body = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Track Forge · Homologate a Grand Prix circuit from your name",
  description:
    "Type a name, watch it become a race track, and collect its licence card. Every letter is a real stretch of a real Grand Prix circuit, stitched into one lap with corners, sectors, elevation, a difficulty grade and a ghost lap.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-ink text-zinc-100">{children}</body>
    </html>
  );
}
