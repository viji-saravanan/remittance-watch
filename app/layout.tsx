import type { Metadata } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const ui = Public_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RemitWatch — the true cost of sending money home",
    template: "%s · RemitWatch",
  },
  description:
    "Ranks money-transfer providers by what transfers actually cost — fees plus the exchange-rate margin others hide. Built on the World Bank's open pricing data. No affiliate links, ever.",
  openGraph: {
    title: "RemitWatch",
    description:
      "Send $200 home and know what it really costs before you choose a provider.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
