import Link from "next/link";
import { colors, font, voile } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerFichesClients } from "@/server/repositories/fiche-client";
import { jourIso } from "@/lib/jour";
import { MOTS_DE_LA_CATEGORIE, type CategorieClient } from "@/lib/civilite";
import ListeClients, { CompteClients, FournisseurClients, HorsDuChoix } from "./ListeClients";
import { compteDeLaPorte } from "@/lib/ligne-du-client";
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
//
// **VOS CLIENTS SOIGNÉE — sa planche `appli/soignee/clients.html`, retenue le
// 29 octobre 2026** (« oui » ; sa condition du 27, importer un tableau, était
// remplie le jour même). Ce qui change ICI : l'en-tête prend la grammaire des
// écrans soignés (le compte en bas de casse sous le titre) ; les deux portes
// deviennent deux cartes dorées côte à côte, chacune avec son nombre, et
// « Vos entreprises » s'appelle « Vos partenaires » ; l'import, geste rare,
// descend au bout de la liste en bouton creux doré. La bande qui suit un
// import en cours reste sous la recherche : elle dit ce qui se passe MAINTENANT.
// Le reste vit dans `ListeClients.tsx`.

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
  const portes = categorie === "particulier" && (
    <Portes
      partenaires={tous.filter((c) => c.categorie === "entreprise").length}
      publics={tous.filter((c) => c.categorie === "public").length}
    />
  );
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
            <EnTeteEcran allure="soignee" retour={retour} titre={mots.titre} />
            <div className="mt-[18px]">{portes}</div>
            {importe && <BandeImport />}
            {/* **Deux phrases, plus trois.** La troisième (« le premier que
                vous créerez apparaîtra ici ») redisait la deuxième avec
                d'autres mots. Ce qui reste enseigne ce qui ne se devine pas :
                on ne crée pas un client, il naît d'un chantier. */}
            <p
              className="mx-[22px] px-1 py-[26px] text-center text-[15.5px] leading-[1.5]"
              style={{ color: colors.inkSoft }}
            >
              {mots.aucun}
            </p>
            {/* **L'écran vide est celui qui importe le plus** : un artisan qui
                arrive sur Atlas n'a encore aucun client. */}
            {importe && <PorteImport />}
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
              // forme vit dans `src/lib/ligne-du-client.ts`, appelée à l'écran.
              facture: c.facture ?? null,
              du: c.du ?? null,
              pieces: c.pieces,
              aHiverner: c.aHiverner,
            }))}
          >
            <EnTeteEcran
              allure="soignee"
              retour={retour}
              titre={mots.titre}
              precision={<CompteClients categorie={categorie} />}
            />
            {/* Le temps du choix ou d'un mois filtré, les portes s'effacent :
                elles mènent ailleurs, et l'on est en train de faire autre chose. */}
            {portes && (
              <HorsDuChoix>
                <div className="mt-[18px]">{portes}</div>
              </HorsDuChoix>
            )}
            <ListeClients
              sousLaRecherche={importe ? <BandeImport /> : null}
              auBout={
                importe ? (
                  <HorsDuChoix>
                    <PorteImport />
                  </HorsDuChoix>
                ) : null
              }
            />
          </FournisseurClients>
        )}
      </div>
    </div>
  );
}

/**
 * Les deux portes, deux cartes côte à côte, toujours là (22 octobre 2026),
 * chacune avec son nombre depuis la planche soignée : savoir qu'il n'y a
 * « Aucun » partenaire évite de toucher pour rien.
 */
function Portes({ partenaires, publics }: { partenaires: number; publics: number }) {
  return (
    <div className="mx-[22px] grid grid-cols-2 gap-[10px]">
      <Porte href="/clients?vue=entreprises" repere="porte-entreprises" nombre={partenaires} dessin={DESSIN_PARTENAIRES}>
        Vos partenaires
      </Porte>
      <Porte href="/clients?vue=publics" repere="porte-services-publics" nombre={publics} dessin={DESSIN_PUBLICS}>
        Services publics
      </Porte>
    </div>
  );
}

/** Un immeuble, et des colonnes : les dessins de la planche, au trait. */
const DESSIN_PARTENAIRES = "M5 20.5V4.5h9v16M14 9.5h5v11M3.5 20.5h17M8 8h3M8 11.5h3M8 15h3";
const DESSIN_PUBLICS = "M3.5 9.5L12 4.5l8.5 5M5.5 9.5v8M9.8 9.5v8M14.2 9.5v8M18.5 9.5v8M3.5 19.5h17";

/**
 * Une porte : l'or, parce que sur cette page l'or ne fait qu'une chose, ce qui
 * MÈNE AILLEURS (sa consigne du 25 octobre, « conserve le code couleur de la
 * page pour le doré »). Une carte qu'on parcourt, à 10 px : en capsule, deux
 * lignes de texte s'y rogneraient.
 */
function Porte({
  href,
  repere,
  nombre,
  dessin,
  children,
}: {
  href: string;
  repere: string;
  nombre: number;
  dessin: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-atlas={repere}
      className="flex min-h-[64px] min-w-0 items-center gap-[10px] rounded-[10px] px-3 py-[10px]"
      style={{ color: colors.or, boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.7)}`, WebkitTapHighlightColor: "transparent" }}
    >
      {/* Sous 380 px, le dessin cède sa place : « partenaires » ne se coupe
          pas, et à 360 px il venait toucher la flèche (mesuré). */}
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-none max-[380px]:hidden">
        <path d={dessin} />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-[1.2]">{children}</span>
        <span className="mt-[2px] block text-[13.5px] font-medium" data-atlas="compte-de-la-porte" style={{ color: colors.inkSoft }}>
          {compteDeLaPorte(nombre)}
        </span>
      </span>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/**
 * « IMPORTER DEVIS / FACTURE » — sa demande du 22 octobre 2026. Le nom est le
 * sien : « pas importer de l'ancienne appli, importer devis facture ». Geste
 * rare, il descend au bout de la liste depuis la planche soignée, en bouton
 * creux doré : il mène ailleurs.
 */
function PorteImport() {
  return (
    <div className="mx-[22px] mt-[28px]">
      <Link
        href="/clients/importer"
        data-atlas="porte-import"
        className="flex min-h-[56px] w-full items-center justify-center gap-[10px] rounded-full px-[22px] text-[17px] font-semibold"
        style={{ color: colors.or, boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.7)}`, WebkitTapHighlightColor: "transparent" }}
      >
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14" />
        </svg>
        Importer devis / facture
      </Link>
    </div>
  );
}
