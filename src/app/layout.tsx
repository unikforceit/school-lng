import type { Metadata, Viewport } from "next";
import "./globals.css";
import LanguageProvider from "@/components/LanguageProvider";

export const metadata: Metadata = {
  title: "School-InG · GNG GROUP",
  description: "Secure, AI-powered school operations with SAGE",
  applicationName: "School-InG",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "School-InG", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#102039", colorScheme: "light" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <body><LanguageProvider><a href="#main-content" className="skip-link">Skip to main content</a>{children}</LanguageProvider></body>
    </html>
  );
}
