import type { Metadata } from "next";
import { Cinzel, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SmoothScrollProvider } from "@/components/shared/providers/SmoothScrollProvider";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Aksaraloka · Bahasa Indonesia Kelas VII — Keterampilan Menulis Teks Naratif",
    template: "%s · Aksaraloka",
  },
  description:
    "Modul pembelajaran digital Bahasa Indonesia Kelas VII SMP. Kuasai keterampilan menulis teks naratif fantasi: susun orientasi, komplikasi, dan resolusi ceritamu sendiri.",
  applicationName: "Aksaraloka",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${cinzel.variable} ${playfair.variable} ${plusJakartaSans.variable} dark`}
    >
      <body className="min-h-dvh bg-[#030712] text-stone-100 font-sans antialiased selection:bg-[#cda250]/30 selection:text-[#f4d993]">
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
