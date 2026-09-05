import { notFound } from "next/navigation";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { chargerFicheClient } from "@/server/repositories/fiche-client";
import { retourFicheClient } from "@/lib/retour-fiche-client";
import { jourCourt } from "@/lib/documents-du-client";
import { numeroLisible } from "@/lib/numero-lisible";
import RegistresDuDossier from "./RegistresDuDossier";
import SupprimerCeClient from "./SupprimerCeClient";
import { apercuSuppressionClient } from "@/server/repositories/donnees-client";

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
  const coordonnees =
    adresse && telephoneLu ? (
      <>
        {adresse}
        <br />
        {telephoneLu}
      </>
    ) : (
      adresse || telephoneLu || undefined
    );
  const { devis, fiches, factures } = fiche.pieces;

  return (
    <div className="pb-[86px]">
      <EnTeteEcran
        retour={retour}
        surtitre="Client"
        titre={fiche.client.nom}
        precision={coordonnees || undefined}
        // La grammaire ample, retenue sur maquette le 2 septembre 2026 : le
        // « Client » doré au-dessus du nom, le nom à 40 px, et les coordonnées
        // en bas de casse. Le détail et son pourquoi vivent dans `EnTeteEcran`.
        allure="ample"
      />

      {/* ─── La dernière prestation ─────────────────────────────────────────
          C'est la première chose qu'il cherche en ouvrant la fiche d'un client
          au téléphone : ce qu'on lui a fait la dernière fois. */}
      {fiche.derniere && (
        <div className="px-[26px] pt-9">
          {/* ── LE POIDS A CHANGÉ DE LIGNE — 2 septembre 2026, sur maquette ──
              Sa demande du 20 août posait le titre « Dernière prestation » en
              noir gras, et son contenu en gris dessous. C'était l'étiquette qui
              portait le poids, pas ce qu'elle nomme — or c'est le contenu qu'il
              vient lire : « ce qu'on lui a fait la dernière fois ».

              Les deux ont donc échangé leur voix : l'étiquette prend celle des
              libellés (capitales espacées, gris), le contenu passe en serif à
              17 px, encre pleine. Ce qu'il cherche est maintenant ce qui se voit
              en premier sous son nom. Le noir gras n'a pas été perdu : il a été
              déplacé sur ce qu'il désignait.

              **Le « · » sépare ici deux choses de MÊME RANG** — l'étiquette et
              sa date —, là où le « : » du 26 août complétait un titre. Le titre
              n'en est plus un. */}
          {/* **La DATE échappe aux capitales**, et seulement elle. « 12 AOÛT
              2026 » s'épelle ; « 12 août 2026 » se lit. L'étiquette, elle, est
              un libellé et garde sa voix. */}
          <p className={libelleCaps} style={{ color: colors.muted }}>
            Dernière prestation
            {fiche.derniere.jour ? (
              <span style={{ textTransform: "none" }}> · {jourCourt(fiche.derniere.jour)}</span>
            ) : null}
          </p>
          {fiche.derniere.comprend.length > 0 && (
            <ul className="mt-3.5 list-none p-0">
              {fiche.derniere.comprend.map((quoi, rang) => (
                <li
                  key={`${quoi}-${rang}`}
                  className={`relative pl-[19px] text-[17px] leading-[1.5] ${rang === 0 ? "" : "mt-1"}`}
                  style={{ color: colors.ink, fontFamily: font.display }}
                >
                  <span
                    className="absolute left-0 top-[11px] block h-[5px] w-[5px] rounded-full"
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
          Ses trois catégories et son ordre du 20 août au soir — Devis, Facture,
          Fiche chantier — mais en onglets plutôt qu'en colonnes de 118 px, où
          « n° 2026-0031 » ne tenait pas. Le pourquoi entier est dans
          `RegistresDuDossier`. */}
      <RegistresDuDossier
        registres={[
          { cle: "devis", libelle: "Devis", pieces: devis, rien: "Aucun devis parti" },
          { cle: "factures", libelle: "Factures", pieces: factures, rien: "Aucune facture émise" },
          { cle: "fiches", libelle: "Fiches", pieces: fiches, rien: "Aucune fiche envoyée" },
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
