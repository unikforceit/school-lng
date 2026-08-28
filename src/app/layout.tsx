import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import LanguageProvider from "@/components/LanguageProvider";
import { isLanguage, languages } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "School-InG · GNG GROUP",
  description: "Secure, AI-powered school operations with SAGE",
  applicationName: "School-InG",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "School-InG", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#102039", colorScheme: "light" };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const saved=(await cookies()).get("sime_language")?.value??null;
  const language=isLanguage(saved)?saved:"fr";
  const direction=languages.find(item=>item.code===language)?.direction??"ltr";
  return (
    <html lang={language} dir={direction} suppressHydrationWarning>
      <body><LanguageProvider initialLanguage={language}><a href="#main-content" className="skip-link">Skip to main content</a>{children}</LanguageProvider></body>
    </html>
  );
}
