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

/** Where the site lives; link previews need absolute image URLs. */
const SITE_URL = "https://lakshya011.github.io/Track_forge/";

const title = "Track Forge · Homologate a Grand Prix circuit from your name";
const description =
  "Type a name, watch it become a race track, and collect its licence card. Every letter is a real stretch of a real Grand Prix circuit, stitched into one lap with corners, sectors, elevation, a difficulty grade and a ghost lap.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  openGraph: {
    title: "Track Forge",
    description,
    url: "./",
    siteName: "Track Forge",
    type: "website",
    images: [{ url: "og.png", width: 1200, height: 630, alt: "A Track Forge circuit licence card" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Track Forge",
    description,
    images: ["og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-ink text-zinc-100">{children}</body>
    </html>
  );
}
