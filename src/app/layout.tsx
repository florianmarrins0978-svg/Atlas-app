import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
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

// Écrans qui ne font pas partie de l'espace de travail du patron et ne doivent
// donc porter NI la navigation, NI l'assistant :
//
// - `/devis/…` est vu par le CLIENT de l'artisan. Lui afficher « Chantiers /
//   Planning / Tarifs » lui donnerait l'illusion d'un accès à l'outil, et ces
//   liens ne mèneraient qu'à une page de connexion. Une barre de navigation
//   inopérante est pire qu'absente.
// - `/login` et `/documents-legaux` précèdent l'entrée dans l'application :
//   naviguer ailleurs n'y a pas de sens.
const CHEMINS_SANS_NAVIGATION = ["/devis", "/login", "/documents-legaux"];

function estEcranSansNavigation(chemin: string | null): boolean {
  if (!chemin) return false;
  return CHEMINS_SANS_NAVIGATION.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Chemin courant transmis par le middleware (voir src/middleware.ts) : une
  // page ne peut pas le connaître autrement.
  const chemin = (await headers()).get("x-atlas-pathname");
  const sansNavigation = estEcranSansNavigation(chemin);

  return (
    <html lang="fr">
      <body className="font-body antialiased">
        {/* Redirige vers l'écran d'acceptation tant qu'un document requis n'a
            pas été accepté. Rendu avant le contenu : la redirection intervient
            donc avant que quoi que ce soit d'utilisable soit affiché. */}
        <GardeDocumentsLegaux />
        {sansNavigation ? (
          <main>{children}</main>
        ) : (
          <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper">
            {/* pb-20 réserve la hauteur de la barre : sans navigation, cette
                marge laisserait un vide en bas de page. */}
            <main className="flex-1 pb-20">{children}</main>
            <AtlasBottomNav />
            <AssistantSidebar />
          </div>
        )}
      </body>
    </html>
  );
}
