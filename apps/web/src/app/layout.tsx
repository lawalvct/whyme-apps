import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/components/I18nProvider";
import "./globals.css";

// latin-ext + vietnamese cover the Igbo letters ị ọ ụ ṅ (docs/03 §6).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

export const metadata: Metadata = {
  title: "WHY ME",
  description: "Products, services and jobs near you",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-text">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
