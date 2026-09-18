import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { charte, variablesCharte, type Charte } from "@/lib/chartes";
import { lireCharte } from "@/server/repositories/charte-personne";
import "./globals.css";
import CadreApplication from "@/components/atlas/CadreApplication";
import { estCheminPublic, estPageDuClient } from "@/lib/chemins-publics";
import VeilleReponseServeur from "@/components/atlas/VeilleReponseServeur";
import GardeDocumentsLegaux from "@/components/atlas/GardeDocumentsLegaux";
import GardeVerificationEmail from "@/components/atlas/GardeVerificationEmail";
import GardeAcces from "@/components/atlas/GardeAcces";
import JournalDeNavigation from "@/components/atlas/JournalDeNavigation";
import BandeauBanc from "@/components/atlas/BandeauBanc";
import { leBandeauDoitParler } from "@/server/etat-banc";
import { roleDeLaSession } from "@/server/autorisation";

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
  // ferait défiler chaque page d'autant — une barre de défilement que lui seul
  // verrait, `scripts/test-aucune-barre-de-defilement-e2e.ts` ne tournant pas
  // sous ce profil.
  //
  // **« D'autant », et plus « de quarante pixels » — 31 août 2026.** Ce nombre
  // était écrit à la main, et faux : le bandeau mesure 49 px, et 66 sur un
  // écran étroit où sa phrase passe à deux lignes. C'est ce qui poussait
  // « Me déconnecter partout » sous la barre du bas (`ARCHITECTURE.md` §227).
  // Il publie désormais sa hauteur lui-même.
  // `leBandeauDoitParler` et non `laVersionRapideSeConstruit` : le banc sert
  // désormais la version rapide PRÉCÉDENTE pendant qu'il bâtit la neuve, et
  // `NODE_ENV` y vaut alors `production`. Le second test répondrait « non »
  // juste au moment où il faut prévenir qu'on regarde le code d'avant.
  const banc = !pageDuClient && leBandeauDoitParler();

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
   *
   * **Il ne se saute plus sur les écrans sans navigation — 17 septembre 2026.**
   * C'est le cadre, désormais, qui sait s'il y a une barre, et il ne le sait
   * qu'au navigateur (`CadreApplication`) : décider ici de ne pas lire le rôle
   * reviendrait à refaire au serveur le choix qui vient d'en partir, et
   * l'accueil atteint depuis le devis n'aurait plus d'onglets. La lecture ne
   * coûte rien de plus : `GardeAcces`, juste au-dessus, l'a déjà faite, et
   * `cache()` la rend une seule fois par requête (`src/server/autorisation.ts`).
   *
   * **Ce qui s'atteint SANS COMPTE reste hors de cette lecture** : la question
   * n'a pas de sens là où il n'y a pas de session, et la poser sur `/login`
   * pourrait renvoyer vers `/api/session-perimee` l'écran qui sert justement à
   * se reconnecter. C'est la même liste que le contrôle d'accès, jamais une
   * seconde (`chemins-publics.ts`).
   */
  const role = chemin && estCheminPublic(chemin) ? null : await roleDeLaSession();

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
        {/* **L'adresse d'abord, les conditions ensuite.** Un compte créé par
            la porte n'entre nulle part tant que le code reçu à son adresse
            n'a pas été entré — sa demande du 14 septembre 2026. */}
        <GardeVerificationEmail />
        <GardeDocumentsLegaux />
        {/* **Le rôle referme ce que le sommaire ne montre plus.** Un bouton
            retiré n'a jamais fermé une adresse : cette garde refuse au SERVEUR,
            avant que la page ne soit peinte (`docs/QUESTIONS.md` §10). */}
        <GardeAcces />
        {/* **Ce qui permet à la flèche de retour d'être un vrai retour.** Il
            tient le journal des écrans traversés dans l'onglet, et chaque
            flèche y lit la page d'où l'on vient — c'est sa demande du
            9 septembre 2026, et le cinquième signalement d'une flèche qui le
            déposait ailleurs (`src/lib/journal-de-navigation.ts`).

            **Ici et pas dans les écrans** : posé écran par écran, ce serait une
            liste à tenir à la main, donc une liste en retard au premier écran
            neuf — le défaut même que ce lot corrige. Il ne dessine rien.

            Jamais sur les deux pages que son CLIENT reçoit : elles ne portent
            aucune flèche, et rien n'a à être rangé dans le navigateur de
            quelqu'un qui ne fait que lire son devis. */}
        {!pageDuClient && <JournalDeNavigation />}
        {/* **DANS le flux, avant tout le reste.** Il pousse le contenu de
            quarante pixels au lieu de le couvrir : trois défauts réels de ce
            dépôt viennent d'éléments flottants qui cachaient un geste
            (`scripts/test-rien-de-recouvert-e2e.ts`). */}
        {banc && <BandeauBanc />}
        {/* **LE CADRE DÉCIDE, ET IL DÉCIDE AU NAVIGATEUR — 17 septembre 2026.**
            Sa capture : *« le menu du bas disparaît »*, sur l'accueil atteint
            juste après l'envoi d'un devis. Ce choix se faisait ici, au serveur,
            et Next.js ne rejoue pas cette mise en page sur une navigation de
            lien : celui fait pour la page du devis — pas de barre, pas de cadre
            — survivait à l'accueil, et pour toute la durée de l'onglet. Le
            détail est dans `CadreApplication`. */}
        <CadreApplication role={role}>{children}</CadreApplication>

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
