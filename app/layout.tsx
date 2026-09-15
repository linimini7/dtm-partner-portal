import type { Metadata } from "next";
import { Onest, Fragment_Mono } from "next/font/google";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const fragmentMono = Fragment_Mono({
  variable: "--font-fragment-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "DTM Partner Portal",
  description: "Deep Tech Momentum partner portal",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${onest.variable} ${fragmentMono.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
