import type { Metadata, Viewport } from "next";
import "./globals.css";
import AtlasBottomNav from "@/components/atlas/AtlasBottomNav";
import AssistantSidebar from "@/components/atlas/AssistantSidebar";

export const metadata: Metadata = {
  title: "Atlas",
  description: "Atlas — dictée de chantier, vérification et préparation de devis.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Atlas",
  },
};

export const viewport: Viewport = {
  themeColor: "#F6F1E6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="font-body antialiased">
        <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper">
          <main className="flex-1 pb-20">{children}</main>
          <AtlasBottomNav />
          <AssistantSidebar />
        </div>
      </body>
    </html>
  );
}
