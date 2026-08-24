import { notFound } from "next/navigation";
import { colors, libelleCaps } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { chargerFicheClient } from "@/server/repositories/fiche-client";
import { retourFicheClient } from "@/lib/retour-fiche-client";
import { jourCourt, type PieceDuClient } from "@/lib/documents-du-client";
import PieceDuDossier from "./PieceDuDossier";

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
// retiré, et c'est la ligne « Dernière prestation · date » elle-même qui passe
// en noir gras. Et l'ordre des colonnes devient **Devis · Facture · Fiche
// chantier** — la facture avant la fiche.
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
export const dynamic = "force-dynamic";

export default async function FicheClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  // **D'où l'on vient décide où la flèche ramène** — sa remarque du 20 août
  // 2026 : « ça ne me fait pas un retour, mais deux ». La règle vit dans
  // `src/lib/retour-fiche-client.ts`, et l'écran ne la refait pas.
  const de = (await searchParams).de;
  const retour = retourFicheClient(Array.isArray(de) ? de[0] : de);
  const ctx = await getCurrentCtx();
  const fiche = await chargerFicheClient(ctx, id);
  if (!fiche) notFound();

  const coordonnees = [fiche.client.adresse, fiche.client.telephone].filter(Boolean).join(" · ");
  const { devis, fiches, factures } = fiche.pieces;
  const aucunePiece = devis.length === 0 && fiches.length === 0 && factures.length === 0;

  return (
    <div className="pb-[86px]">
      <EnTeteEcran
        retour={retour}
        surtitre="Client"
        titre={fiche.client.nom}
        precision={coordonnees || undefined}
      />

      {/* ─── La dernière prestation, en titre noir gras ────────────────────
          Il l'a demandée en toutes lettres, et c'est la première chose qu'il
          cherche en ouvrant la fiche d'un client au téléphone : ce qu'on lui a
          fait la dernière fois. Le noir franc la sépare du gris des
          coordonnées — sans quoi elle se lirait comme une ligne d'information
          de plus. */}
      {fiche.derniere && (
        <div className="px-[26px] pt-5">
          {/* **Le titre EST « Dernière prestation », en noir gras.** Sa demande
              du 20 août 2026 : le nom qui suivait (le nom du chantier) répétait
              le nom du client en tête d'écran — « je veux plus voir le nom en
              dessous ». On l'a retiré, et c'est cette ligne-ci qui porte le noir
              gras, avec la date. Le détail vit dans les puces en dessous. */}
          <p className={libelleCaps} style={{ color: colors.ink, fontWeight: 700 }}>
            Dernière prestation
            {fiche.derniere.jour ? ` · ${jourCourt(fiche.derniere.jour)}` : ""}
          </p>
          {fiche.derniere.comprend.length > 0 && (
            <ul className="mt-[11px] list-none p-0">
              {fiche.derniere.comprend.map((quoi, rang) => (
                <li key={`${quoi}-${rang}`} className="relative mt-1.5 pl-[15px] text-[14px] leading-[1.45]"
                    style={{ color: colors.inkSoft }}>
                  <span
                    className="absolute left-0 top-2 block h-[5px] w-[5px] rounded-full"
                    style={{ backgroundColor: colors.or }}
                  />
                  {quoi}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ─── Les trois colonnes de papiers ─────────────────────────────────
          Trois colonnes sur 390 px : la vignette monte AU-DESSUS du numéro, et
          les marges tombent à 16 px. Mesuré sur la maquette — la vignette à
          gauche ne laissait que ~79 px de texte, et « n° 2026-031 » se coupait.
          `min-w-0` sur chaque colonne : sans lui, un enfant de grille prend la
          largeur de son plus long contenu et pousse la page de côté. */}
      <div className="mt-6 grid grid-cols-3 gap-[7px] px-4">
        <Colonne titre="Devis" pieces={devis} rien="Aucun devis parti" />
        <Colonne titre="Facture" pieces={factures} rien="Aucune facture émise" />
        <Colonne titre="Fiche chantier" pieces={fiches} rien="Aucune fiche envoyée" />
      </div>

      {/* Trois colonnes vides sans un mot laisseraient croire à un écran cassé.
          Un client tout neuf n'a simplement pas encore de papiers. */}
      {aucunePiece && (
        <p className="mt-4 px-[26px] text-[13px] leading-relaxed" style={{ color: colors.muted }}>
          Aucun document pour ce client. C’est sa fiche : elle se remplira au premier devis parti.
        </p>
      )}
    </div>
  );
}

/**
 * Un encadré de papiers.
 *
 * **Une colonne vide DIT qu'elle est vide**, et dit pourquoi. « Aucun devis
 * parti » n'est pas la même chose que « aucun chantier terminé » : la première
 * se règle en envoyant un devis, la seconde en finissant un chantier. Un cadre
 * muet ferait chercher une panne.
 */
function Colonne({ titre, pieces, rien }: { titre: string; pieces: PieceDuClient[]; rien: string }) {
  return (
    <div className="min-w-0 rounded-[12px] px-[9px] pb-2.5 pt-3" style={{ backgroundColor: colors.card }}>
      <h3
        className="m-0 text-[9px] font-semibold uppercase leading-[1.3]"
        style={{ letterSpacing: "0.12em", color: colors.ink }}
      >
        {titre}
      </h3>
      <span className="mt-[3px] block text-[10.5px]" style={{ color: colors.muted }}>
        {pieces.length === 0 ? "—" : `${pieces.length} pièce${pieces.length > 1 ? "s" : ""}`}
      </span>

      {pieces.length === 0 ? (
        <p className="mt-2.5 text-[10.5px] leading-snug" style={{ color: colors.muted }}>
          {rien}
        </p>
      ) : (
        // **Un appui ouvre trois choix, il ne télécharge plus d'office.**
        // Sa demande du 21 août 2026, et son choix devant la planche 83 : la C.
        // Le raisonnement — et les trois conditions de « Enregistrer » — vit
        // dans `PieceDuDossier`.
        pieces.map((piece, rang) => (
          <div
            key={piece.id}
            style={rang === 0 ? undefined : { borderTop: `1px solid ${colors.line}` }}
          >
            <PieceDuDossier piece={piece} />
          </div>
        ))
      )}
    </div>
  );
}
