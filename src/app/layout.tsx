import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { charte, variablesCharte, type Charte } from "@/lib/chartes";
import { lireCharte } from "@/server/repositories/charte-personne";
import "./globals.css";
import AtlasBottomNav from "@/components/atlas/AtlasBottomNav";
import { estCheminPublic, estPageDuClient } from "@/lib/chemins-publics";
import VeilleReponseServeur from "@/components/atlas/VeilleReponseServeur";
import AssistantSidebar from "@/components/atlas/AssistantSidebar";
import { FournisseurAssistant } from "@/components/atlas/assistant-contexte";
import GardeDocumentsLegaux from "@/components/atlas/GardeDocumentsLegaux";
import GardeAcces from "@/components/atlas/GardeAcces";
import BandeauBanc from "@/components/atlas/BandeauBanc";
import { laVersionRapideSeConstruit } from "@/server/etat-banc";
import { roleDeLaSession } from "@/server/autorisation";
import { peutUtiliserLAssistant } from "@/lib/acces-roles";

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
  // **Confirmé le soir même, signature comprise.** Le patron renvoie l'erreur
  // entière, cette fois depuis `/devis/<jeton>` : le lien inséré porte
  // `x-apple-data-detectors="true"` et
  // `x-apple-data-detectors-type="telephone"`. Ce n'était donc plus une
  // déduction à partir d'un diff partiel : c'est iOS, nommément, et sur les
  // DEUX écrans que voit le client de l'artisan — la facture et le devis.
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

// Écrans qui ne portent NI la navigation, NI l'assistant.
//
// **Les écrans PUBLICS ne sont plus listés ici : ils viennent du même endroit
// que le contrôle d'accès** (`src/lib/chemins-publics.ts`).
//
// Le patron, le 12 août 2026, capture à l'appui : *« lorsque le client reçoit
// le lien cliquable de la facture, s'il clique en dessous sur planning ou
// chantier, il a accès à mon application. »* Il n'y avait pas de fuite — ces
// liens mènent à la page de connexion — mais son client voyait les onglets de
// son outil de travail au bas de sa facture.
//
// La cause n'était pas un oubli isolé : **deux listes tenaient la même vérité.**
// Le middleware savait `/factures` public depuis le 6 août ; celle-ci ne
// connaissait que `/devis`. Un écran public ajouté plus tard n'entrait que dans
// l'une des deux. Une seule source, donc, et l'invariant tient désormais par
// construction : ce qui s'atteint sans compte ne porte jamais la navigation.
//
// Restent ici les écrans du PATRON qui n'ont pas de navigation pour une raison
// qui leur est propre — ils ne sont pas publics, et n'ont donc rien à faire
// dans la liste partagée :
//
// - `/documents-legaux` précède l'entrée dans l'application : naviguer ailleurs
//   n'y a pas de sens.
// - `…/devis-complet` est le devis lui-même, seul sur sa page. Le patron l'a
//   demandé ainsi : « une page où il n'y a que le devis ». Une barre d'onglets
//   au bas d'une feuille de devis la fait ressembler à un écran d'application,
//   et c'est précisément ce qu'elle ne doit pas être.
const ECRANS_DU_PATRON_SANS_NAVIGATION = ["/documents-legaux"];

function estEcranSansNavigation(chemin: string | null): boolean {
  if (!chemin) return false;
  if (estCheminPublic(chemin)) return true;
  if (chemin.endsWith("/devis-complet")) return true;
  return ECRANS_DU_PATRON_SANS_NAVIGATION.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}

/**
 * La charte choisie, sous forme de style en ligne.
 *
 * React n'accepte une variable CSS que comme propriété à part entière : une
 * chaîne `--a:b;--c:d` posée dans `style` est ignorée sans un mot.
 */
function variablesEnStyle(c: Charte): Record<string, string> {
  // **Il reparcourait `c.jetons` lui-même, et c'était une seconde
  // implémentation de `variablesCharte`** — interdite par `CLAUDE.md` §3. Les
  // deux ont divergé au premier changement : la police de « Brume moderne »
  // était émise d'un côté et pas de l'autre, si bien que le réglage s'écrivait,
  // les couleurs changeaient, et la typographie non. Rien ne le disait.
  return variablesCharte(c);
}

/**
 * Ce que la personne connectée a choisi — ou rien.
 *
 * **Jamais d'exception.** Une couleur est un agrément : un visiteur sans
 * session, une base muette, un compte effacé ne doivent pas empêcher la page
 * de s'afficher. Sans réponse, les jetons retombent sur leur repli, qui est la
 * charte d'origine.
 */
async function charteDeLaPersonne(): Promise<Charte | null> {
  try {
    const nom = await lireCharte();
    return nom ? charte(nom) : null;
  } catch {
    return null;
  }
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
  // Le veilleur parle du banc, des mises à jour et d'Atlas : c'est la langue du
  // patron. Sur les deux pages que son client reçoit, elle n'a rien à faire.
  const pageDuClient = estPageDuClient(chemin);
  // **Le banc en train de bâtir sa version rapide, et lui seul.** Décidé au
  // serveur : hors banc d'essai, le bandeau n'est même pas envoyé au navigateur,
  // et aucun écran n'a à connaître cette notion. Jamais sur les deux pages que
  // son client reçoit — elles parlent au client, pas au patron.
  //
  // **Et la hauteur du cadre en tient compte** (plus bas, `minHeight`).
  // `min-h-dvh` seul ajouterait la hauteur du bandeau à celle de l'écran et
  // ferait défiler chaque page de quarante pixels — une barre de défilement que
  // lui seul verrait, `scripts/test-aucune-barre-de-defilement-e2e.ts` ne
  // tournant pas sous ce profil.
  const banc = !pageDuClient && laVersionRapideSeConstruit();

  /**
   * La charte de couleurs de la personne connectée (`src/lib/chartes.ts`).
   *
   * **Décidée AU SERVEUR, et posée dans le HTML lui-même.** Une bascule faite
   * au navigateur ferait apparaître l'écran en couleurs d'origine avant de le
   * repeindre — un clignotement à chaque page, sur un téléphone lent, qui se
   * lit comme un défaut.
   *
   * **Les deux pages que son CLIENT reçoit n'y ont pas droit** : le devis et la
   * facture ne changent pas de couleur parce que l'artisan a choisi « Nuit ».
   * Elles portent l'identité d'Atlas, pas son goût.
   *
   * **Et si rien n'est lisible — visiteur sans session, base muette — on ne
   * pose rien.** Les jetons retombent alors sur leur repli, qui EST la charte
   * d'origine : l'écran est exactement celui d'avant ce lot.
   */
  const charteChoisie = pageDuClient ? null : await charteDeLaPersonne();

  /**
   * **Le rôle décide des onglets, et il vient du SERVEUR.**
   *
   * La barre est un composant client : lui laisser lire le rôle voudrait dire
   * l'envoyer au navigateur et le croire. Il est donc résolu ici, à chaque
   * requête, à partir de la seule session — et il ne sert qu'à DESSINER : ce qui
   * refuse une adresse, c'est `GardeAcces` juste au-dessus.
   */
  const role = sansNavigation ? null : await roleDeLaSession();

  return (
    // **Les variables sont posées sur `<html>`, pas sur `<body>`.**
    // `globals.css` les relit depuis `:root` — c'est-à-dire `<html>` — pour
    // alimenter les classes Tailwind. Posées sur le corps, elles auraient été
    // invisibles de là, et la moitié de l'écran serait restée dans l'ancienne
    // charte : vu sur une capture, la bande sous la barre de navigation.
    <html lang="fr" style={charteChoisie ? (variablesEnStyle(charteChoisie) as React.CSSProperties) : undefined}>
      <body className="font-body antialiased">
        {/* Redirige vers l'écran d'acceptation tant qu'un document requis n'a
            pas été accepté. Rendu avant le contenu : la redirection intervient
            donc avant que quoi que ce soit d'utilisable soit affiché. */}
        <GardeDocumentsLegaux />
        {/* **Le rôle referme ce que le sommaire ne montre plus.** Un bouton
            retiré n'a jamais fermé une adresse : cette garde refuse au SERVEUR,
            avant que la page ne soit peinte (`docs/QUESTIONS.md` §10). */}
        <GardeAcces />
        {/* **DANS le flux, avant tout le reste.** Il pousse le contenu de
            quarante pixels au lieu de le couvrir : trois défauts réels de ce
            dépôt viennent d'éléments flottants qui cachaient un geste
            (`scripts/test-rien-de-recouvert-e2e.ts`). */}
        {banc && <BandeauBanc />}
        {sansNavigation ? (
          <main>{children}</main>
        ) : (
          // Le fournisseur entoure le contenu ET le panneau : depuis le
          // 13 août 2026, le bouton de l'assistant vit dans l'en-tête de chaque
          // écran, donc DANS `children`, tandis que le panneau reste ici pour
          // couvrir tout le reste. Les deux se parlent par ce contexte — voir
          // `assistant-contexte.tsx`.
          //
          // Il n'entoure QUE le cadre, sans en changer la hauteur : celle-ci
          // tient compte du bandeau du banc (`minHeight` ci-dessous), et un
          // fournisseur ne rend aucun élément.
          // L'assistant reconstitue au serveur les chantiers, les clients et
          // les prix, et sait lire le devis de n'importe quel client : il est au
          // patron seul (`peutUtiliserLAssistant`, sa demande du 25 août). Le
          // refus est dans l'action (`poserQuestionAction`) ; ici, on ne lui
          // montre pas un bouton qui ne répondrait pas.
          <FournisseurAssistant disponible={!!role && peutUtiliserLAssistant(role)}>
            <div
              className="mx-auto flex max-w-md flex-col bg-paper"
              style={{ minHeight: banc ? "calc(100dvh - 40px)" : "100dvh" }}
            >
            {/* `atlas-contenu` réserve la hauteur de la barre, indicateur
                d'accueil compris (voir globals.css) : sans navigation, cette
                marge laisserait un vide en bas de page. */}
            <main className="atlas-contenu flex-1">{children}</main>
            <AtlasBottomNav role={role} />
            {role !== "salarie" && <AssistantSidebar />}
          </div>
          </FournisseurAssistant>
        )}

        {/* **HORS du choix ci-dessus, et c'est un correctif.** Quand la réponse
            du serveur n'a pas pu être lue, une phrase en français plutôt qu'un
            panneau anglais — ou, sur la version rapide, plutôt que rien du
            tout.

            Il était d'abord posé dans la seule branche à barre de navigation :
            l'écran de CONNEXION en était donc dépourvu. C'est précisément
            l'écran où une réponse coupée est la plus probable — c'est le
            premier appel, celui qui compile tout — et le seul où le patron n'a
            aucun autre repère. La suite navigateur l'a montré avant que
            quiconque ne le lise. */}
        {!pageDuClient && <VeilleReponseServeur />}
      </body>
    </html>
  );
}
