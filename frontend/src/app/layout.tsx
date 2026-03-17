import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import MainLayout from "@/components/MainLayout";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aethelgard | AI Origination Engine",
  description: "Proprietary intelligence for M&A and Private Equity origination.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <MainLayout interVariable={inter.variable} outfitVariable={outfit.variable}>
        {children}
      </MainLayout>
    </html>
  );
}

