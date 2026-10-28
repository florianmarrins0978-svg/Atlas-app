import { notFound } from "next/navigation";
import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import FlecheRetour from "@/components/atlas/FlecheRetour";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import { getCurrentCtx } from "@/server/session-ctx";
import { chargerFicheClient } from "@/server/repositories/fiche-client";
import { retourFicheClient } from "@/lib/retour-fiche-client";
import { jourCourt } from "@/lib/documents-du-client";
import { numeroLisible } from "@/lib/numero-lisible";
import { nomDuDossierClient } from "@/lib/dossier-du-client";
import { jourIso } from "@/lib/jour";
import RegistresDuDossier from "./RegistresDuDossier";
import RepartirDeCeClient from "./RepartirDeCeClient";
import SupprimerCeClient from "./SupprimerCeClient";
import { apercuSuppressionClient } from "@/server/repositories/donnees-client";
import { garderLaPage } from "@/server/garde-page";

// **La fiche d'un client : son nom, ce qu'on lui a fait la dernière fois, et
// ses papiers.**
//
// **Sa demande du 20 août 2026**, capture de cet écran à l'appui :
//
//   « En dessous de l'adresse, en titre noir gras, dernière prestation avec ce
//     qu'elle comprend. Ensuite : pas trois encadrés, seulement deux. Un
//     contenant devis, et l'autre fiche chantier… en deux colonnes… trié par
//     date, de la plus récente à la moins récente. On garde le nom et les
//     informations sous le nom. Tout le reste, tu enlèves. C'est du trop. »
//
// Puis, le même jour : « tu peux rajouter une colonne facture et ranger les
// factures dans le même ordre ».
//
// **Puis, toujours le 20 août, deux corrections sur capture :** le « nom » sous
// « Dernière prestation » répétait le nom du client déjà en tête (un chantier
// porte le nom de son client) — « je veux plus voir le nom en dessous ». Il est
// retiré. Et l'ordre devient **Devis · Facture · Fiche chantier** — la facture
// avant la fiche.
//
// **REFONDU LE 2 SEPTEMBRE 2026, sur maquette qu'il a regardée puis retenue :**
// *« c'est très bien, code exactement ce que tu viens de me faire comme
// maquette »*. Trois choses changent, et rien de sa VÉRITÉ ne bouge :
//
//   1. l'en-tête passe en allure « ample » — « Client » doré AU-DESSUS du nom,
//      nom à 40 px, coordonnées en bas de casse (`EnTeteEcran`) ;
//   2. « Dernière prestation » cède son noir gras à CE QU'ELLE NOMME : le
//      contenu passe en serif 17 px, l'étiquette en capitales grises. C'est un
//      revirement de sa demande du 20 août, assumé — le bloc à l'endroit même
//      dit pourquoi ;
//   3. les trois colonnes deviennent trois REGISTRES à onglets
//      (`RegistresDuDossier`) : ses catégories et son tri survivent, la forme
//      change parce que 118 px coupaient les numéros.
//
// **CE QUI A ÉTÉ RETIRÉ, et c'était l'essentiel de la demande** : les trois
// cases (chantiers · facturés · reste dû), la liste « Ce qu'on lui fait, et
// combien de fois », la liste « Ses chantiers », et la phrase d'excuse quand
// rien n'est facturé. Sa plainte, la quatrième en dix jours : « il y a beaucoup
// trop de mots dans tous les sens ».
//
// **Ce que le retrait coûte, et qu'il faut savoir :** on n'ouvre plus un
// chantier depuis un client. On ouvre sa fiche de chantier en PDF — un document
// se lit, un écran se modifie. Il a été prévenu, il a tranché.
//
// **Le reste dû n'est plus ici.** Il se regarde dans Terminés → En attente de
// paiement. Les données restent chargées (`chargerFicheClient` les calcule pour
// la liste des clients) : le jour où il les redemande, il n'y a qu'à les poser.
//
// Dessiné avant d'être codé : `appli/fiche-client.html` (`CLAUDE.md` §3 bis).
//
// **SOIGNÉE LE 25 OCTOBRE 2026, sur sa planche `appli/soignee/client.html`**,
// regardée et reprise trois fois le même soir, puis *« ok code ça »*. Rien de
// ce qui précède ne bouge ; ce qui change se lit :
//
//   1. le nom et ses coordonnées tiennent dans une plage, « Client » en doré
//      au-dessus, **sans encadré** (*« enlève l'encadré doré autour du
//      client »*), et la flèche partage sa ligne avec l'assistant ;
//   2. **le téléphone appelle et l'adresse ouvre le plan** au toucher (*« oui,
//      tu peux mettre lorsqu'il clique sur le téléphone, ça appelle »*) ;
//   3. Modifier ses coordonnées et Tout télécharger passent en bas de la plage,
//      côte à côte, avec leur dessin ;
//   4. les trois gestes perdent leur encadré et gardent leur place
//      (`RepartirDeCeClient`), les onglets leur petite taille
//      (`RegistresDuDossier`), les pièces leur colonne de date
//      (`PieceDuDossier`) ; Supprimer ce client s'écrit en toutes lettres.
//
// **L'en-tête n'est plus `EnTeteEcran`.** Son allure « ample » n'existait que
// pour cette fiche, et la plage qui porte le nom n'y entre pas. La retirer de la
// pièce partagée toucherait cinquante-trois écrans, donc la batterie entière :
// c'est noté dans `TODO.md`, pour le prochain lot qui touchera `EnTeteEcran`.
export const dynamic = "force-dynamic";

export default async function FicheClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await garderLaPage();
  const { id } = await params;
  // **D'où l'on vient décide où la flèche ramène** — sa remarque du 20 août
  // 2026 : « ça ne me fait pas un retour, mais deux ». La règle vit dans
  // `src/lib/retour-fiche-client.ts`, et l'écran ne la refait pas.
  const de = (await searchParams).de;
  const retour = retourFicheClient(Array.isArray(de) ? de[0] : de);
  const ctx = await getCurrentCtx();
  const fiche = await chargerFicheClient(ctx, id);
  if (!fiche) notFound();

  // **Ce que la suppression laisserait, lu AVANT de rien toucher.** La même
  // fonction sert l'avertissement et la suppression elle-même : deux calculs de
  // « ce qui reste » finiraient par diverger, et c'est l'écran qui mentirait —
  // on lui promettrait que tout part, et la facture resterait (`CLAUDE.md` §3).
  const apercu = await apercuSuppressionClient(ctx, id);

  // **L'ADRESSE, PUIS LE TÉLÉPHONE À LA LIGNE — sa demande du 26 août 2026 :**
  // *« supprime le point entre l'adresse et le numéro de tel ; le tel doit être
  // à la ligne sous l'adresse »*. Sur son téléphone, l'adresse tient déjà sur
  // deux lignes : le numéro collé derrière un séparateur se lisait comme la fin
  // de l'adresse.
  const { adresse, telephone } = fiche.client;
  // **LE NUMÉRO SE LIT ESPACÉ, ICI COMME AVANT D'ENVOYER.** Il est rangé en
  // chiffres nus (`numeroEnregistre`, pour que le rapprochement de clients et
  // le lien `sms:` n'aient pas à le renettoyer), et cette fiche l'affichait
  // donc tel quel : `0679984514`. Or c'est ici qu'on vérifie qu'on a le bon
  // client — la raison même pour laquelle `numeroLisible` avait été écrite le
  // 12 août 2026, et qui n'avait servi qu'à l'écran d'envoi. Trouvé par
  // l'audit du 5 septembre 2026 ; sa réponse : « espace-le partout ».
  const telephoneLu = telephone ? numeroLisible(telephone) : telephone;
  // **Le toucher appelle, et ouvre le plan — sa réponse du 25 octobre 2026.**
  // Le lien `tel:` prend les chiffres nus, ceux que `numeroEnregistre` range
  // déjà ; le plan se cherche par l'adresse telle qu'il l'a tapée. Rien n'est
  // souligné : il l'a demandé le même soir, en voyant la planche.
  const appel = telephone ? `tel:${telephone.replace(/[^\d+]/g, "")}` : null;
  const plan = adresse ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}` : null;
  const { devis, fiches, factures, avoirs } = fiche.pieces;
  // Sans aucune pièce, il n'y a rien à emporter : un fichier vide ferait croire
  // à un dossier perdu.
  const unePiece = devis.length + factures.length + fiches.length + avoirs.length > 0;

  return (
    <div className="pb-[86px]">
      <div className="flex items-center justify-between gap-4 px-[22px] pt-7">
        {/* Le dessin est ici, la DESTINATION est ailleurs : `retour` est le
            repli, la flèche ramène d'abord à la page d'avant (9 septembre 2026). */}
        <FlecheRetour repli={retour} allure="cerne" fleche={15} />
        <BoutonAssistant />
      </div>

      {/* ─── LE CLIENT, DANS SA PLAGE ─────────────────────────────────────────
          « Client » en doré AU-DESSUS du nom, comme il l'a voulu le
          2 septembre ; l'adresse puis le téléphone À LA LIGNE, comme le
          26 août. La plage n'a pas de liseré : il l'a fait retirer en la
          voyant sur la planche. */}
      <div className="mx-[22px] mt-[14px] rounded-[6px] px-4 pb-1 pt-4" style={{ backgroundColor: colors.card }}>
        <header>
          <p className="text-[13px] font-bold uppercase" style={{ color: colors.or, letterSpacing: "0.14em" }}>
            Client
          </p>
          <h1
            className="mt-0.5 text-[31px] leading-[1.05]"
            style={{ fontFamily: font.display, letterSpacing: "-0.012em" }}
          >
            {fiche.client.nom}
          </h1>
          {/* **L'encre douce, et non l'encre pleine.** C'est la dernière
              prestation, plus bas, qui porte l'encre pleine : la ligne qu'il
              vient lire doit se détacher de ce qui l'entoure
              (`test-fiche-client-e2e`). */}
          {(plan || appel) && (
            <p className="mt-2 text-[16px] leading-[1.3]" style={{ color: colors.inkSoft }}>
              {plan && (
                <a
                  href={plan}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-atlas="adresse-du-client"
                  className="flex min-h-[40px] items-center gap-2.5"
                >
                  <Icone d={DESSIN_LIEU} doree />
                  {adresse}
                </a>
              )}
              {appel && (
                <a href={appel} data-atlas="appeler-le-client" className="flex min-h-[40px] items-center gap-2.5">
                  <Icone d={DESSIN_TELEPHONE} doree />
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{telephoneLu}</span>
                </a>
              )}
            </p>
          )}
        </header>

        {/* ─── LES DEUX GESTES SUR LE CLIENT LUI-MÊME ──────────────────────────
            Modifier ses coordonnées (« la A », 14 septembre 2026) et Tout
            télécharger (« la A », 22 octobre 2026), dans la voix dorée de ce qui
            MÈNE, côte à côte au pied de la plage plutôt que l'un sous l'autre en
            petites capitales. Le second est un lien et non une action serveur :
            la route rend le fichier, le navigateur le range. */}
        <div className="mt-2 flex" style={{ borderTop: `1px solid ${colors.line}` }}>
          <Link
            href={`/clients/${fiche.client.id}/coordonnees`}
            data-atlas="modifier-le-client"
            className="flex min-h-[50px] flex-1 items-center justify-center gap-2 px-2 text-[14.5px] font-bold leading-[1.2]"
            style={{ color: colors.or }}
          >
            <Icone d={DESSIN_CRAYON} taille={20} />
            Modifier ses coordonnées
          </Link>
          {unePiece && (
            <a
              href={`/api/clients/${fiche.client.id}/dossier`}
              // Le NOM porté par le lien, et le même que la route : sans lui,
              // Safari range le fichier sous le nom de la page, sans extension
              // (leçon de « Télécharger mes données »).
              download={nomDuDossierClient(fiche.client.nom, jourIso(new Date()))}
              data-atlas="tout-telecharger"
              className="flex min-h-[50px] flex-1 items-center justify-center gap-2 px-2 text-[14.5px] font-bold leading-[1.2]"
              style={{ color: colors.or, borderLeft: `1px solid ${colors.line}` }}
            >
              <Icone d={DESSIN_TELECHARGER} taille={20} />
              Tout télécharger
            </a>
          )}
        </div>
      </div>

      <RepartirDeCeClient clientId={fiche.client.id} dernierChantierId={fiche.chantierDuDernierDevis} />

      {/* ─── La dernière prestation ─────────────────────────────────────────
          Ce qu'on lui a fait la dernière fois. **Le contenu porte l'encre
          pleine, l'étiquette l'encre douce** (revirement du 2 septembre 2026,
          sur maquette) : c'est ce qu'elle nomme qu'il vient lire. L'étiquette
          garde son gras, la date la suit après une virgule : une phrase, ni
          point médian ni capitales (`CLAUDE.md` §3). */}
      {fiche.derniere && (
        <div className="mx-[22px] mt-3 rounded-[6px] px-4 py-3" style={{ backgroundColor: colors.card }}>
          <p className="text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            <strong style={{ color: colors.ink }}>Dernière prestation</strong>
            {fiche.derniere.jour ? `, le ${jourCourt(fiche.derniere.jour)}` : null}
          </p>
          {fiche.derniere.comprend.length > 0 && (
            <ul className="mt-2 list-none p-0">
              {fiche.derniere.comprend.map((quoi, rang) => (
                <li
                  key={`${quoi}-${rang}`}
                  className="relative py-[3px] pl-[18px] text-[17px] leading-[1.3]"
                  style={{ color: colors.ink, fontFamily: font.display }}
                >
                  <span
                    className="absolute left-[2px] top-[11px] block h-[7px] w-[7px] rounded-full"
                    style={{ backgroundColor: colors.or }}
                  />
                  {quoi}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ─── Le dossier : trois registres, un seul ouvert ───────────────────
          Ses trois catégories et son ordre du 20 août au soir, Devis, Facture,
          Fiche chantier. Le pourquoi entier est dans `RegistresDuDossier`. */}
      <RegistresDuDossier
        nomClient={fiche.client.nom}
        registres={[
          { cle: "devis", libelle: "Devis", pieces: devis, rien: "Aucun devis parti" },
          { cle: "factures", libelle: "Factures", pieces: factures, rien: "Aucune facture émise" },
          { cle: "fiches", libelle: "Fiches", pieces: fiches, rien: "Aucune fiche envoyée" },
          // **L'onglet n'existe que chez un client qui a reçu un avoir** — sa
          // règle du 24 septembre 2026 : *« cette catégorie doit se créer
          // seulement lorsque j'envoie un avoir, car ça risque d'être hyper
          // rare »*. Un onglet vide chez tous les autres serait du bruit.
          ...(avoirs.length > 0 ? [{ cle: "avoirs", libelle: "Avoirs", pieces: avoirs, rien: "" }] : []),
        ]}
      />

      <SupprimerCeClient
        clientId={id}
        nom={fiche.client.nom}
        documents={apercu?.documents ?? 0}
        conserve={(apercu?.pieces ?? []).map((p) => ({ numero: p.numero, pourquoi: p.pourquoi }))}
      />

      {/* **Plus de phrase quand il n'y a aucun document — 26 août 2026 :**
          *« supprime la phrase en gris lorsqu'il n'y a aucun document, on le
          voit, pas besoin de l'écrire »*. Les trois registres disent déjà
          « Aucun devis parti », « Aucune facture émise », « Aucune fiche
          envoyée » : la phrase les répétait une quatrième fois. */}
    </div>
  );
}

/* Les quatre dessins de la plage, au trait de la planche (1,75 sur une grille
   de 24). Ceux des coordonnées sont dorés sur un texte à l'encre douce ; ceux
   des deux gestes prennent la couleur de leur mot. */
const DESSIN_LIEU =
  "M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11zM12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z";
const DESSIN_TELEPHONE =
  "M6.6 3.5h2.9l1.5 4.4-2 1.3a11 11 0 0 0 5.8 5.8l1.3-2 4.4 1.5v2.9a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z";
const DESSIN_CRAYON = "M4.5 19.5l1-4.3L15.6 5.1a2.1 2.1 0 0 1 3 3L8.5 18.5zM13.5 7.2l3 3";
const DESSIN_TELECHARGER = "M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14";

function Icone({ d, taille = 22, doree = false }: { d: string; taille?: number; doree?: boolean }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke={doree ? colors.or : "currentColor"}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-none"
    >
      <path d={d} />
    </svg>
  );
}
