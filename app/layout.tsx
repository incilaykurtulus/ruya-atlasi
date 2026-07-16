import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#070612",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = "Rüya Atlası | Yapay Zekâ ile Rüya Yorumu";
  const description = "Rüyanı anlat; duygularını, sembollerini ve olası anlamlarını yapay zekâ ile keşfet.";

  return {
    metadataBase,
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "tr_TR",
      images: [{ url: new URL("/og.png", metadataBase), width: 1672, height: 941, alt: "Rüya Atlası" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [new URL("/og.png", metadataBase)] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className={`${display.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
