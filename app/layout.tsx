import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// เพิ่มการนำเข้า Component สำหรับ Track Visitor
import VisitorTracker from "@/components/VisitorTracker";
import { ErrorBoundaryWrapper } from "@/components/ErrorBoundaryWrapper";
import { SWRProvider } from "@/components/SWRProvider"; 

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jutpai",
  description: "Secondhand marketplace",
  icons: {
    icon: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/avatars/PNG.png",
    shortcut: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/avatars/PNG.png",
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
        <ErrorBoundaryWrapper>
          <SWRProvider>
            {/* เพิ่มส่วนบันทึกข้อมูลผู้เข้าชม */}
            <VisitorTracker />
            {children}
          </SWRProvider>
        </ErrorBoundaryWrapper>
      </body>
    </html>
  );
}
