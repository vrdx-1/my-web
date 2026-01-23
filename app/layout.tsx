import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// เพิ่มการนำเข้า Component สำหรับ Track Visitor
import VisitorTracker from "@/components/VisitorTracker"; 

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "jutpai.com",
  description: "Second-hand products marketplace",
  icons: {
    icon: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/avatars/9a8595cc-bfa6-407d-94d4-67e2e82523e5/WhatsApp%20Image%202026-01-09%20at%2016.10.33%20(1).jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* เพิ่มส่วนบันทึกข้อมูลผู้เข้าชม */}
        <VisitorTracker />
        {children}
      </body>
    </html>
  );
}
