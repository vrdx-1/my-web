import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BackHandler from "@/components/BackHandler";
import { BackHandlerProvider } from "@/components/BackHandlerContext";
import RedirectToHomeOnReturn from "@/components/RedirectToHomeOnReturn";
import { ErrorBoundaryWrapper } from "@/components/ErrorBoundaryWrapper";
import { SWRProvider } from "@/components/SWRProvider";
import { SuggestionTermsProvider } from "@/contexts/SuggestionTermsContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { DailyVisitorTracker } from "@/components/DailyVisitorTracker";
import { BottomNavWrapper } from "@/components/BottomNavWrapper";
import { SavePostSuccessPopupHost } from "@/components/modals/SavePostSuccessPopupHost";
import { DevServiceWorkerReset } from "@/components/DevServiceWorkerReset";
import { HeaderVisibilityProvider } from "@/contexts/HeaderVisibilityContext";
import { SessionProfileProvider } from "@/contexts/SessionProfileContext";
import { CreatePostProvider } from "@/contexts/CreatePostContext";
import { NotificationRefreshProvider } from "@/contexts/NotificationRefreshContext";
import { HomeRefreshProvider } from "@/contexts/HomeRefreshContext";
import { ComparePostsProvider } from "@/contexts/ComparePostsContext";
import { SITE_URL } from "@/lib/siteConfig";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_NAME = "Jutpai";
const APP_DESCRIPTION = "ຕະຫຼາດລົດມືສອງປະເທດລາວ";

export const viewport: Viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
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
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DevServiceWorkerReset />
        <ErrorBoundaryWrapper>
          <SuggestionTermsProvider>
            <SWRProvider>
            {/* กดย้อนกลับ (browser/มือถือ) ปิด overlay ตามสเต็ป แล้ว back ตามสเต็ป */}
            <CreatePostProvider>
            <NotificationRefreshProvider>
            <HomeRefreshProvider>
            <BackHandlerProvider>
              <BackHandler />
              {/* ออกจากเว็บ/เบราว์เซอร์ แล้วกลับเข้ามา → อยู่หน้า home เท่านั้น */}
              <RedirectToHomeOnReturn />
              <PWAInstallPrompt />
              <SavePostSuccessPopupHost />
              <HeaderVisibilityProvider>
                <SessionProfileProvider>
                  <ComparePostsProvider>
                    <DailyVisitorTracker />
                    <BottomNavWrapper>{children}</BottomNavWrapper>
                  </ComparePostsProvider>
                </SessionProfileProvider>
              </HeaderVisibilityProvider>
            </BackHandlerProvider>
            </HomeRefreshProvider>
            </NotificationRefreshProvider>
            </CreatePostProvider>
            </SWRProvider>
          </SuggestionTermsProvider>
        </ErrorBoundaryWrapper>
      </body>
    </html>
  );
}
