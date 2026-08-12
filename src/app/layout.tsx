import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import AtlasBottomNav from "@/components/atlas/AtlasBottomNav";
import AssistantSidebar from "@/components/atlas/AssistantSidebar";
import GardeDocumentsLegaux from "@/components/atlas/GardeDocumentsLegaux";

// **Plus aucune police n'est téléchargée depuis le 10 août 2026.** L'écran que
// le patron a retenu était une maquette autonome : elle ne pouvait charger
// aucune police et empruntait celles de son appareil. C'est ce dessin-là qu'il
// a validé, et il l'a redemandé en propres termes. Les piles sont dans
// `globals.css` — voir le commentaire de `--font-display`.
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

  // **Safari fabriquait des liens que personne n'avait écrits.**
  //
  // Le 12 août 2026, le patron ouvre la page publique d'une facture sur son
  // iPhone et reçoit « Hydration failed ». Le diff de React désignait le
  // coupable sans ambiguïté : le DOM portait
  // `<a href="tel:2026-0003">` là où le composant ne rend que le texte
  // `2026-0003`. Or **aucune page de ce dépôt n'écrit de `tel:` sur un numéro
  // de facture** — le lien ne pouvait venir que du navigateur.
  //
  // iOS reconnaît d'office ce qui ressemble à un numéro de téléphone, à une
  // adresse ou à un courriel, et **réécrit le HTML avant que React ne
  // s'installe dessus**. Un numéro de facture — huit chiffres et un tiret — lui
  // ressemble assez. React trouve alors un `<a>` là où il attendait du texte,
  // annonce une panne, et refabrique tout l'arbre côté client.
  //
  // Ce n'est pas qu'une alerte : le numéro devenait un lien d'appel sous le
  // doigt du client de l'artisan, et le devis complet comme la facture portent
  // ce numéro en titre.
  //
  // Les trois sont coupés, pas seulement le téléphone : les deux autres cassent
  // de la même façon, et attendre qu'il le découvre lui-même coûterait un
  // aller-retour de plus. **Rien n'est perdu au passage** — cela n'éteint que la
  // détection AUTOMATIQUE ; les `tel:` qu'Atlas écrit lui-même (« appeler » sur
  // la fiche du client) et le bouton « Y aller » continuent de fonctionner.
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f3ee",
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
// - `…/devis-complet` est le devis lui-même, seul sur sa page. Le patron l'a
//   demandé ainsi : « une page où il n'y a que le devis ». Une barre d'onglets
//   au bas d'une feuille de devis la fait ressembler à un écran d'application,
//   et c'est précisément ce qu'elle ne doit pas être.
const CHEMINS_SANS_NAVIGATION = ["/devis", "/login", "/documents-legaux"];

function estEcranSansNavigation(chemin: string | null): boolean {
  if (!chemin) return false;
  if (chemin.endsWith("/devis-complet")) return true;
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
