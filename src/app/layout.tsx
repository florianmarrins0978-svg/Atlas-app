import type { Metadata, Viewport } from "next";
import "./globals.css";
import AtlasBottomNav from "@/components/atlas/AtlasBottomNav";
import AssistantSidebar from "@/components/atlas/AssistantSidebar";
import GardeDocumentsLegaux from "@/components/atlas/GardeDocumentsLegaux";

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
        {/* Redirige vers l'écran d'acceptation tant qu'un document requis n'a
            pas été accepté. Rendu avant le contenu : la redirection intervient
            donc avant que quoi que ce soit d'utilisable soit affiché. */}
        <GardeDocumentsLegaux />
        <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper">
          <main className="flex-1 pb-20">{children}</main>
          <AtlasBottomNav />
          <AssistantSidebar />
        </div>
      </body>
    </html>
  );
}
