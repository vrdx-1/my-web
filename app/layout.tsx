import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// เพิ่มการนำเข้า Component สำหรับ Track Visitor
import VisitorTracker from "@/components/VisitorTracker";
import BackHandler from "@/components/BackHandler";
import { BackHandlerProvider } from "@/components/BackHandlerContext";
import RedirectToHomeOnReturn from "@/components/RedirectToHomeOnReturn";
import { ErrorBoundaryWrapper } from "@/components/ErrorBoundaryWrapper";
import { SWRProvider } from "@/components/SWRProvider";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_NAME = "Jutpai";
const APP_DESCRIPTION = "Secondhand marketplace";

export const viewport: Viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/avatars/PNG.png", sizes: "any", type: "image/png" },
    ],
    shortcut: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/avatars/PNG.png",
    apple: "/icons/apple-touch-icon.png",
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
            {/* กดย้อนกลับ (browser/มือถือ) ปิด overlay ตามสเต็ป แล้ว back ตามสเต็ป */}
            <BackHandlerProvider>
              <BackHandler />
              {/* ออกจากเว็บ/เบราว์เซอร์ แล้วกลับเข้ามา → อยู่หน้า home เท่านั้น */}
              <RedirectToHomeOnReturn />
              <PWAInstallPrompt />
              {children}
            </BackHandlerProvider>
          </SWRProvider>
        </ErrorBoundaryWrapper>
      </body>
    </html>
  );
}
