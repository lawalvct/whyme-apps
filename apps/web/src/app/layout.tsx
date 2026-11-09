import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SkipLink } from "@/components/site/SkipLink";
import "./globals.css";

// latin-ext + vietnamese cover the Igbo letters ị ọ ụ ṅ (docs/03 §6).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "WHY ME: buy, sell and hire in Delta State", template: "%s | WHY ME" },
  description: "Products, trusted service providers and jobs in Delta State, with payments held safely until you're satisfied.",
  openGraph: { siteName: "WHY ME", type: "website", locale: "en_NG" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-text">
        <Providers>
          <SkipLink />
          <SiteHeader />
          <main id="content" className="site-main mx-auto w-full flex-1">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
