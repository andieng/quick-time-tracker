import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const description =
  "Quick Time Tracker is a free, minimal time tracker for your activities. Start tracking instantly as a guest — no signup required — or sign in with Google to sync across devices.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Quick Time Tracker",
  description,
  keywords: [
    "time tracker",
    "activity tracker",
    "free time tracker",
    "online stopwatch",
    "focus timer",
    "productivity tracker",
  ],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Quick Time Tracker",
    title: "Quick Time Tracker",
    description,
    images: [{ url: "/opengraph-image" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quick Time Tracker",
    description,
    images: ["/opengraph-image"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Quick Time Tracker",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Any (web-based)",
  description,
  url: SITE_URL,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-void text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
