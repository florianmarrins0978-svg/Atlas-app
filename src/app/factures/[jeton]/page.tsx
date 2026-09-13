import { factureParJeton } from "@/server/repositories/envois-factures";
import { jourLisible } from "@/lib/jour";
import BoutonTelechargerDocument from "@/components/atlas/BoutonTelechargerDocument";
import NumeroDeDocument from "@/components/atlas/NumeroDeDocument";
import { colors, font, libelleCaps, surPlein } from "@/lib/design-tokens";
import { LIBELLE_AVANT, LIBELLE_APRES, phraseDuCheque } from "@/lib/modalites-paiement";
import PastilleACopier from "./PastilleACopier";
import AccuseDeReception from "./AccuseDeReception";

/**
 * LA PAGE QUE VOIT SON CLIENT — refaite le 8 septembre 2026, sur sa capture.
 *
 * Ses mots : *« il faut le modifier, déjà mets-le aux couleurs de l'appli.
 * Ensuite le montant ne doit pas apparaître, ça incitera le client à ouvrir sa
 * facture. Donc il faut supprimer "voir la facture en PDF", on garde que
 * télécharger. Ensuite rajouter une phrase bien écrite pour dire que pour nous
 * régler il faut impérativement mettre le numéro de facture dans le libellé. Et
 * tu rajoutes le numéro de facture en cliquable (copier-coller) automatique pour
 * les virements bancaires, et une phrase pour les paiements par chèque, l'ordre
 * de l'entreprise — tout ça en automatique, repris des infos que l'utilisateur
 * rentrera dans ses réglages. »*
 *
 * Dessinée d'abord (`appli/la-page-de-sa-facture.html`), codée ensuite, comme
 * `CLAUDE.md` §3 bis l'exige.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **AUX COULEURS D'ATLAS, ET CELA ROUVRE UNE RÈGLE À LUI.** Cette page portait
 * l'allure FIGÉE de la facture (migration 0074) : un artisan ayant réglé un
 * accent noir pour ses documents voyait une page noire, ce qui est exactement la
 * capture qu'il a envoyée. Sa décision du 4 septembre disait pourtant : *« mon
 * client doit retrouver en ligne exactement ce qu'il a reçu en PDF ».*
 *
 * Elle est révisée, par lui, après avoir vu la proposition en crème et vert.
 * **La règle devient : le PDF est SON document et garde son allure ; la page est
 * l'enveloppe d'Atlas et porte les couleurs d'Atlas.** Ce ne sont pas deux fois
 * le même objet — l'un s'archive et se garde, l'autre se traverse.
 *
 * **Ce n'est toujours PAS sa charte d'écran** : une facture ne part pas en noir
 * chez le client parce qu'il a choisi « Nuit ». Sur une page de client,
 * `layout.tsx` ne pose aucune variable, et les jetons retombent sur leur repli —
 * la charte d'Arborea, qui EST l'identité d'Atlas (`design-tokens.ts`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LE MONTANT A DISPARU, ET CE QUE CELA COÛTE EST ÉCRIT.** *« Ça incitera le
 * client à ouvrir sa facture. »* La réserve lui a été dite avant d'être codée :
 * celui qui règle sans ouvrir le PDF n'a pas le montant sous les yeux.
 * L'échéance reste — sans elle, la page ne dirait plus qu'il y a une date.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **UN SEUL BOUTON.** « Voir en PDF » et « Télécharger » se disputaient le
 * geste, pour deux chemins qui mènent au même fichier. Il ne reste que celui qui
 * met la facture dans le téléphone du client — et ce n'est plus un lien depuis
 * le 12 septembre 2026 : la page va chercher le document et le remet à la
 * feuille de partage, seule voie qui range un PDF sur un iPhone
 * (`BoutonTelechargerDocument`).
 */

// La page que voit le client quand il touche le lien de sa facture.
//
// Elle existe parce que rien ne portait la facture jusqu'à lui : l'écran du
// patron annonçait « facture arrêtée », il a compris « facture partie », et son
// client n'a jamais rien reçu (6 août 2026).
//
// Pourquoi une page plutôt que le PDF directement : un lien qui ouvre un PDF
// nu, sur un téléphone, ne dit ni de qui il vient ni ce qu'il faut en faire —
// et un lien périmé y répond par une erreur brute. Ici, le client reconnaît sa
// facture avant de la télécharger, et surtout il sait COMMENT régler.
//
// `force-dynamic` est impératif : une mise en cache exposerait la facture d'un
// client à un autre visiteur.
export const dynamic = "force-dynamic";

// Une facture n'a rien à faire dans un moteur de recherche.
export const metadata = { robots: { index: false, follow: false } };

const SERIF = "ui-serif, Georgia, serif";

function Cadre({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center p-6"
      style={{ backgroundColor: colors.cream, color: colors.ink }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 text-center shadow-sm"
        style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}` }}
      >
        <h1 className="text-[18px] font-semibold" style={{ fontFamily: SERIF }}>
          {titre}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: colors.muted }}>
          {texte}
        </p>
      </div>
    </div>
  );
}

export default async function PageFactureClient({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const facture = await factureParJeton(jeton);

  // Lien inconnu et lien expiré donnent le même message : distinguer les deux
  // apprendrait à un visiteur au hasard qu'un jeton a existé.
  if (!facture) {
    return (
      <Cadre
        titre="Ce lien n'est plus valable"
        texte="Contactez votre artisan pour en recevoir un nouveau."
      />
    );
  }

  const { modalites } = facture;

  return (
    <div
      className="flex min-h-dvh items-center justify-center p-6"
      style={{ backgroundColor: colors.cream, color: colors.ink }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 text-center"
        style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.line}`,
          boxShadow: "0 8px 24px rgba(20,18,14,0.08)",
        }}
      >
        <p className={libelleCaps} style={{ color: colors.or }}>
          Facture
        </p>
        <h1 className="mt-2.5 text-[24px]" style={{ fontFamily: font.display }}>
          <NumeroDeDocument valeur={facture.numeroCommercial} />
        </h1>
        <p className="mt-1.5 text-[14.5px]" style={{ color: colors.muted }}>
          {facture.entrepriseNom}
        </p>

        {facture.echeanceLe && (
          <p className="mt-3.5 text-[14.5px]" style={{ color: colors.inkSoft }}>
            À régler avant le {jourLisible(facture.echeanceLe)}
          </p>
        )}

        <BoutonTelechargerDocument
          fichier={`/factures/${encodeURIComponent(jeton)}/pdf`}
          nom={`${facture.numeroCommercial}.pdf`}
          className="atlas-plein mt-5 block w-full rounded-full px-5 py-[15px] text-[17px]"
          style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
        >
          Télécharger ma facture
        </BoutonTelechargerDocument>

        {/* **« Pour régler » est séparé par un FILET, jamais par une seconde
            carte.** Deux cadres emboîtés font lire deux documents là où il n'y
            en a qu'un — vu sur la planche avant de coder. */}
        <div className="mt-5 border-t pt-4 text-left" style={{ borderColor: colors.line }}>
          <p className={`mb-3 ${libelleCaps}`} style={{ color: colors.muted }}>
            Pour régler
          </p>

          {/* La consigne du libellé vaut même sans IBAN réglé : elle porte sur le
              virement, pas sur le compte. Le numéro est en gras AU MILIEU de la
              phrase — c'est ce que le client doit recopier, et l'œil doit
              l'attraper sans lire. */}
          <p className="text-[14.5px] leading-[1.55]" style={{ color: colors.inkSoft }}>
            {LIBELLE_AVANT}{" "}
            <b className="font-medium" style={{ color: colors.ink }}>
              {facture.numeroCommercial}
            </b>{" "}
            {LIBELLE_APRES}
          </p>

          <PastilleACopier
            quoi="Numéro de facture"
            affiche={facture.numeroCommercial}
            aCopier={facture.numeroCommercial}
          />

          {/* **Rien ne s'affiche quand l'IBAN n'est pas réglé** — jamais une case
              vide, jamais un « IBAN : ». Un champ sans source reste vide et se
              tait (`CLAUDE.md` §4). Le reste du pavé, lui, garde tout son sens. */}
          {modalites.ibanLisible && modalites.ibanACopier && (
            <PastilleACopier
              quoi="IBAN"
              affiche={modalites.ibanLisible}
              aCopier={modalites.ibanACopier}
            />
          )}

          <div className="mt-4 border-t pt-4" style={{ borderColor: colors.line }}>
            <p className="text-[14.5px] leading-[1.55]" style={{ color: colors.inkSoft }}>
              {phraseDuCheque(modalites.ordreDuCheque)}
            </p>
          </div>
        </div>

        {/* **La dernière chose de la page, et c'est voulu** — sa demande du
            9 septembre 2026. Sous « Télécharger ma facture », une case se
            lirait comme une condition pour ouvrir le document ; ici, personne
            ne peut s'y tromper. Elle porte aussi la date d'ouverture, notée
            depuis le navigateur : voir `AccuseDeReception`. */}
        <AccuseDeReception
          jeton={jeton}
          dejaConfirmeLe={facture.accuseLe ? facture.accuseLe.toISOString() : null}
        />
      </div>
    </div>
  );
}
