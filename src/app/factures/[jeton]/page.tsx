import { factureParJeton } from "@/server/repositories/envois-factures";
import { jourLisible } from "@/lib/jour";
import { motDuTampon } from "@/lib/acomptes-facture";
import BoutonTelechargerDocument from "@/components/atlas/BoutonTelechargerDocument";
import NumeroDeDocument from "@/components/atlas/NumeroDeDocument";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { EcranDeRetour } from "@/components/atlas/LettreDuClient";
import IconeTrait from "@/components/atlas/IconeTrait";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import { LIBELLE_AVANT, LIBELLE_APRES, phraseDuCheque } from "@/lib/modalites-paiement";
import PastilleACopier from "./PastilleACopier";
import AccuseDeReception from "./AccuseDeReception";
import { garderLaPage } from "@/server/garde-page";

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

export default async function PageFactureClient({ params }: { params: Promise<{ jeton: string }> }) {
  await garderLaPage();
  const { jeton } = await params;
  const facture = await factureParJeton(jeton);

  // Lien inconnu et lien expiré donnent le même message : distinguer les deux
  // apprendrait à un visiteur au hasard qu'un jeton a existé.
  if (!facture) {
    return (
      <EcranDeRetour
        signe="sablier"
        ton="or"
        titre="Ce lien n'est plus valable"
        texte="Contactez votre artisan pour en recevoir un nouveau."
      />
    );
  }

  const { modalites } = facture;

  /* **L'esprit d'aujourd'hui, soigné — sa réponse du 1er novembre 2026 :**
     *« pour la facture j'aurais aimé garder un peu le même esprit que celui
     d'aujourd'hui, mais en amélioré et plus jolie »* (planche
     `appli/soignee/client-recoit.html`). Donc la carte au centre, le mot
     Facture en or au-dessus du numéro, puis Pour régler et l'accusé, dans le
     même ordre. Ce qui change : ce qui se lit (le numéro en grand, l'échéance
     en pastille, des mots à 13 points au lieu de 9,5) et ce qui se touche
     (des pilules de 64 points, « Copier » au pouce). L'ombre et la bordure de
     la carte s'en vont : une plage claire sur le fond suffit, comme dans
     l'appli. */
  return (
    <div className="min-h-dvh px-3.5 pt-4 pb-7" style={{ backgroundColor: colors.cream, color: colors.ink }}>
      <div className="mx-auto w-full max-w-md rounded-[22px] px-[22px] pt-[30px] pb-[22px] text-center" style={{ backgroundColor: colors.card }}>
        <p className="text-[13px] font-bold uppercase tracking-[0.24em]" style={{ color: colors.or }}>
          Facture
        </p>
        <h1 className="mt-2.5 text-[33px] leading-[1.1] tabular-nums" style={{ fontFamily: font.display, letterSpacing: "-0.01em" }}>
          <NumeroDeDocument valeur={facture.numeroCommercial} />
        </h1>
        <p className="mt-1.5 text-[16px]" style={{ color: colors.inkSoft }}>
          {facture.entrepriseNom}
        </p>

        {/* L'exemplaire acquitté dit son tampon à la place de l'échéance (sa
            demande du 23 octobre 2026). L'un et l'autre en pastille : un
            point ET un mot, jamais la couleur seule. */}
        {facture.acquitteeLe ? (
          <div className="mt-4">
            <EtatEcrit ton="vert" dataAtlas="facture-acquittee">
              {motDuTampon(facture.acquitteeLe)}
            </EtatEcrit>
          </div>
        ) : (
          facture.echeanceLe && (
            <div className="mt-4">
              <EtatEcrit ton="ambre">À régler avant le {jourLisible(facture.echeanceLe)}</EtatEcrit>
            </div>
          )
        )}

        {/* **PAS DE MONTANT sur cette page — sa demande du 8 septembre 2026 :**
            *« le montant ne doit pas apparaître, ça incitera le client à
            ouvrir sa facture »*. Le geste qui l'ouvre est donc le plus fort. */}
        <BoutonTelechargerDocument
          fichier={`/factures/${encodeURIComponent(jeton)}/pdf`}
          nom={`${facture.numeroCommercial}.pdf`}
          className="atlas-plein mt-[22px] flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-full px-5 text-[19px]"
          style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
        >
          <IconeTrait nom="telecharger" taille={19} epaisseur={1.8} />
          Télécharger ma facture
        </BoutonTelechargerDocument>

        {/* **L'avoir se trouve SOUS la facture qu'il corrige** — il part avec
            son lien (`composerMessageAvoir`). Au trait doré, le mot en encre :
            c'est une seconde pièce, pas le geste principal de la page. */}
        {facture.avoirs.map((a) => (
          <BoutonTelechargerDocument
            key={a.id}
            fichier={`/factures/${encodeURIComponent(jeton)}/avoirs/${a.id}/pdf`}
            nom={`${a.numero}.pdf`}
            className="mt-2.5 flex min-h-[50px] w-full items-center justify-center rounded-full px-5 text-[15.5px] font-semibold"
            style={{ boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.7)}`, color: colors.ink }}
            dataAtlas="telecharger-avoir"
          >
            Télécharger l&apos;avoir {a.numero}
          </BoutonTelechargerDocument>
        ))}

        {/* **« Pour régler » est séparé par un FILET, jamais par une seconde
            carte.** Deux cadres emboîtés font lire deux documents là où il n'y
            en a qu'un. */}
        {!facture.acquitteeLe && (
          <div className="text-left">
            <Filet />
            <p className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.inkSoft }}>
              Pour régler
            </p>
            {/* La consigne du libellé vaut même sans IBAN réglé : elle porte sur
                le virement, pas sur le compte. Le numéro est en gras AU MILIEU
                de la phrase : c'est ce que le client doit recopier. */}
            <p className="text-[15.5px] leading-[1.55]" style={{ color: colors.inkSoft }}>
              {LIBELLE_AVANT}{" "}
              <b className="font-semibold" style={{ color: colors.ink }}>
                {facture.numeroCommercial}
              </b>{" "}
              {LIBELLE_APRES}
            </p>
            <PastilleACopier
              quoi="Numéro de facture"
              affiche={facture.numeroCommercial}
              aCopier={facture.numeroCommercial}
            />
            {/* **Rien ne s'affiche quand l'IBAN n'est pas réglé** — jamais une
                case vide, jamais un « IBAN : ». Un champ sans source se tait
                (`CLAUDE.md` §4). */}
            {modalites.ibanLisible && modalites.ibanACopier && (
              <PastilleACopier
                quoi="IBAN"
                affiche={modalites.ibanLisible}
                aCopier={modalites.ibanACopier}
              />
            )}
            <Filet />
            <p className="text-[15.5px] leading-[1.55]" style={{ color: colors.inkSoft }}>
              {phraseDuCheque(modalites.ordreDuCheque)}
            </p>
          </div>
        )}

        {/* **La dernière chose de la page, et c'est voulu** — sa demande du
            9 septembre 2026. Sous « Télécharger ma facture », une case se
            lirait comme une condition pour ouvrir le document ; ici, personne
            ne peut s'y tromper. Elle porte aussi la date d'ouverture, notée
            depuis le navigateur : voir `AccuseDeReception`. */}
        <Filet />
        <AccuseDeReception
          jeton={jeton}
          dejaConfirmeLe={facture.accuseLe ? facture.accuseLe.toISOString() : null}
        />
      </div>
    </div>
  );
}

/** Le filet qui sépare les parties de la carte : une seule pièce, jamais deux cadres. */
function Filet() {
  return <div aria-hidden="true" className="mt-6 mb-5 h-px" style={{ backgroundColor: colors.line }} />;
}
