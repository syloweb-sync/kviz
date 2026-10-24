import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/site/providers";
import { siteUrl } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Pitalica — kviz uživo za ekipu", template: "%s · Pitalica" },
  description:
    "Napravite kviz, podijelite PIN i igrajte uživo s prijateljima, obitelji ili razredom. Igrači se pridružuju s mobitela, bez računa.",
  applicationName: "Pitalica",
  openGraph: { type: "website", locale: "hr_HR", siteName: "Pitalica" },
};

export const viewport: Viewport = {
  themeColor: "#0d0a26",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <body className="backdrop-night">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
