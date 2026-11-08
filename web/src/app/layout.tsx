import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";

import { AuthProvider } from "@/lib/auth";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

// Hanken Grotesk carries the console (labels, data, controls); Newsreader is kept to page titles
// and the wordmark. Both are self-hosted by next/font and exposed as CSS variables for tokens.css.
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", weight: ["500"], style: ["normal"] });

export const metadata: Metadata = {
  title: { default: "CareRound Console", template: "%s · CareRound Console" },
  description: "Operations console for home-care visits: live staff locations, verified clock-ins and visit records.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f2ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f0e" },
  ],
};

// Applies a saved light/dark choice before the first paint (no flash on reload).
const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-page text-ink antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
