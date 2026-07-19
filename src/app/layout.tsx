import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "NYC Discovery – Find your next thing to do",
  description: "Discover restaurants, classes, shows, and events in New York City",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[#0f0f0f] text-[#f5f5f5] pb-14">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
