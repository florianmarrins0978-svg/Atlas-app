import Link from "next/link";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerFichesClients } from "@/server/repositories/fiche-client";
import { jourIso } from "@/lib/jour";
import { MOTS_DE_LA_CATEGORIE, type CategorieClient } from "@/lib/civilite";
import ListeClients, { CompteClients, FournisseurClients } from "./ListeClients";
import BandeImport from "./BandeImport";
import { estProprietaire } from "@/server/autorisation";
import { garderLaPage } from "@/server/garde-page";

// **La liste de ses clients — sa remarque du 17 août 2026 au soir.**
//
// *« La catégorie client n'a pas été créée. »* La FICHE d'un client existait
// depuis la veille (arrangement B de `docs/maquettes/66`), mais elle ne
// s'atteignait que depuis un chantier : il n'y avait aucun endroit d'où voir
// ses clients, ni retrouver celui qu'on a en tête sans se rappeler pour quel
// chantier on l'avait noté.
//
// **Sans cinquième onglet, et ce n'est pas un demi-choix.** La barre du bas en
// porte quatre, et le cinquième est déjà décidé pour les outils métier
// (`ARCHITECTURE.md` §125) ; à cinq colonnes sur 360 px, « CHANTIERS » déborde
// déjà. La liste s'ouvre donc depuis l'accueil, là où il est déjà.
//
// **Rien ne s'invente ici** : un client dont aucun chantier n'est facturé
// n'affiche pas « 0 € », il affiche qu'il n'y a pas encore eu de facture. Un
// zéro se lirait comme un mauvais payeur (`CLAUDE.md` §4).
//
// ─────────────────────────────────────────────────────────────────────────────
// **REFONDU LE 3 SEPTEMBRE 2026, sur maquette retenue** (`appli/vos-clients.html`,
// *« tu peux coder exactement cette maquette »*). Trois choses changent ICI ; le
// reste vit dans `ListeClients.tsx`, qui porte le détail et son pourquoi.
//
//   1. **Le titre nomme l'écran, le compte passe dessous.** Il portait
//      « 21 clients » à 36 px et « VOS CLIENTS » en capitales dorées en dessous
//      — le compte à la place du nom, et deux fois la même chose en deux voix.
//      Les deux fentes d'`EnTeteEcran` existaient déjà : on échange ce qu'on y
//      met. Le compte s'anime (`CompteClients`) et suit la frappe, là où l'œil
//      est ; il était écrit sous le DERNIER résultat, donc hors de l'écran au
//      moment précis où il sert.
//   2. **Le lieu descend jusqu'à l'écran.** `adresse` était en base sans être
//      chargée.
//   3. **Le jour se lit au SERVEUR** (`jourIso`, à l'heure de son atelier) et
//      descend en accessoire. Le lire dans le navigateur donnerait l'horloge du
//      téléphone : entre minuit et deux heures, l'heure d'été sépare les deux, et
//      la date de la ligne clignoterait à l'hydratation.
//
// **De A à Z depuis le 27 septembre 2026** : l'ordre vient du dépôt
// (`rangerParNom`), les bandes sont des lettres. `dernierJour` ne descend plus
// jusqu'ici : il ne sert qu'à départager deux homonymes, au dépôt.

//
// **SES ENTREPRISES DERRIÈRE UNE PORTE — sa consigne du 4 octobre 2026 :**
// *« mets pas particulier et entreprise, on est d'office sur les particuliers,
// rajoute juste une porte pour aller sur l'entreprise »*
// (`appli/entreprises-clientes.html`). Une entreprise est un client dont la
// fiche porte « Entreprise », ou dont le nom porte SARL… (`estUneEntreprise`).
// La porte reprend celle de « Vos clients › » sur l'écran Chantiers ;
// derrière, la même liste, la même recherche.
//
// **SES SERVICES PUBLICS, UNE SECONDE PORTE — 22 octobre 2026**
// (`appli/facture-mairie-chorus.html`) : une mairie, un département, une
// communauté de communes. Sa demande : *« trois catégories, et l'utilisateur
// s'y retrouve facilement »*, puis *« les deux portes, laisse-les visibles
// constamment, même s'il n'y en a pas encore »*. Une porte qui n'apparaît
// qu'au premier client caché ne se trouve pas le jour où l'on cherche où le
// ranger.

export const dynamic = "force-dynamic";

/** L'adresse de chaque liste : un paramètre, pas un second écran à tenir. */
const VUES: Record<string, CategorieClient> = { entreprises: "entreprise", publics: "public" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const vue = (await searchParams).vue;
  const categorie: CategorieClient = (typeof vue === "string" && VUES[vue]) || "particulier";
  const mots = MOTS_DE_LA_CATEGORIE[categorie];
  const tous = await listerFichesClients(ctx);
  const clients = tous.filter((c) => c.categorie === categorie);
  // Les portes ne se montrent que sur la liste d'office, celle des particuliers.
  const portes = categorie === "particulier";
  // **« Importer devis / facture » est un geste du patron** (`import/garde.ts`) :
  // les autres rôles ne voient ni la porte ni la bande.
  const importe = categorie === "particulier" && (await estProprietaire(ctx));
  const retour =
    categorie === "particulier"
      ? { href: "/", libelle: "Retour à la liste des chantiers" }
      : { href: "/clients", libelle: "Retour à vos clients" };

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-[86px]">
        {clients.length === 0 ? (
          <>
            <EnTeteEcran retour={retour} titre={mots.titre} />
            {portes && <Portes />}
            {/* **L'écran vide est celui qui importe le plus** : un artisan qui
                arrive sur Atlas n'a encore aucun client. */}
            {importe && <PorteImport />}
            {importe && <BandeImport />}
            {/* **Deux phrases, plus trois.** La troisième — « le premier que
                vous créerez apparaîtra ici » — redisait la deuxième avec
                d'autres mots. Ce qui reste enseigne ce qui ne se devine pas :
                on ne crée pas un client, il naît d'un chantier. */}
            <p
              className="mx-[26px] mt-[26px] max-w-[31ch] text-[13px] leading-[1.6]"
              style={{ color: colors.inkSoft }}
            >
              {mots.aucun}
            </p>
          </>
        ) : (
          <FournisseurClients
            aujourdHui={jourIso(new Date())}
            clients={clients.map((c) => ({
              id: c.id,
              nom: c.nom,
              adresse: c.adresse,
              derniere: c.derniere,
              joursDevis: c.joursDevis,
              joursFactures: c.joursFactures,
              // Les montants voyagent tels que le dépôt les rend : leur mise en
              // forme vit dans `enEuros`, appelée une seule fois, à l'écran.
              facture: c.facture ?? null,
              du: c.du ?? null,
              pieces: c.pieces,
            }))}
          >
            <EnTeteEcran retour={retour} titre={mots.titre} precision={<CompteClients categorie={categorie} />} />
            {portes && <Portes />}
            <ListeClients
              sousLaRecherche={
                importe ? (
                  <>
                    <PorteImport />
                    <BandeImport />
                  </>
                ) : null
              }
            />
          </FournisseurClients>
        )}
      </div>
    </div>
  );
}

/** Les deux portes, l'une sous l'autre, toujours là (22 octobre 2026). */
function Portes() {
  return (
    <>
      <Porte href="/clients?vue=entreprises" repere="porte-entreprises">
        Vos entreprises
      </Porte>
      <Porte href="/clients?vue=publics" repere="porte-services-publics">
        Services publics
      </Porte>
    </>
  );
}

/**
 * « IMPORTER DEVIS / FACTURE » — sa demande du 22 octobre 2026, à la place que
 * la maquette lui a montrée : sous la recherche, dans la voix de « Modifier ses
 * coordonnées » (l'or, en capitales espacées). Le nom est le sien : « pas
 * importer de l'ancienne appli, importer devis facture ».
 */
function PorteImport() {
  return (
    <div className="px-[26px]">
      <Link
        href="/clients/importer"
        data-atlas="porte-import"
        className={`inline-flex min-h-[44px] items-center gap-[10px] ${libelleCaps}`}
        style={{ color: colors.orTexte }}
      >
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15V4m-4.5 4.5L12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" />
        </svg>
        Importer devis / facture
      </Link>
    </div>
  );
}

/**
 * « VOS ENTREPRISES › », « SERVICES PUBLICS › » — la porte de « Vos clients › » sur l'écran Chantiers,
 * trait pour trait : le mot doré en capitales espacées, le chevron qui dit
 * qu'il mène ailleurs, 44 px de cible pour un pouce ganté.
 */
function Porte({ href, repere, children }: { href: string; repere: string; children: React.ReactNode }) {
  return (
    <div className="px-[26px]">
      <Link
        href={href}
        data-atlas={repere}
        className="inline-flex min-h-[44px] items-center text-[11px] font-medium uppercase"
        style={{ color: colors.or, letterSpacing: "0.28em" }}
      >
        {children}
        <span
          aria-hidden="true"
          className="ml-[5px] text-[19px] font-bold leading-none"
          style={{ letterSpacing: 0, position: "relative", top: -1 }}
        >
          ›
        </span>
      </Link>
    </div>
  );
}
