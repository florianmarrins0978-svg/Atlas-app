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
  // iOS ne lit pas les icônes du manifeste : il cherche `apple-touch-icon`.
  // L'oublier donne, sur l'écran d'accueil, une vignette de la page au lieu
  // d'un logo — et c'est la première chose que voit l'artisan.
  icons: {
    icon: [
      { url: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icones/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
  // Sans quoi `env(safe-area-inset-*)` vaut toujours zéro et la page reste
  // cantonnée entre des bandes blanches, encoche comprise. C'est cette valeur
  // qui autorise l'application à occuper l'écran entier — les marges de
  // sécurité étant alors rendues par globals.css.
  viewportFit: "cover",
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
            {/* `atlas-contenu` réserve la hauteur de la barre, indicateur
                d'accueil compris (voir globals.css) : sans navigation, cette
                marge laisserait un vide en bas de page. */}
            <main className="atlas-contenu flex-1">{children}</main>
            <AtlasBottomNav />
            <AssistantSidebar />
          </div>
        )}
      </body>
    </html>
  );
}
