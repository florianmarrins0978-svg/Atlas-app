import Link from "next/link";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerChantiersTermines } from "@/server/repositories/factures";
import { preparer } from "@/lib/termines-par-mois";
import ListeTermines from "./ListeTermines";
import { tvaDeLaPeriodeCourante } from "@/server/tva-courante";

export const dynamic = "force-dynamic";

/**
 * « Terminés » — un mois à la fois, et l'état écrit en toutes lettres.
 *
 * *Refait le 22 août 2026 d'après la planche 90, proposition B
 * (`appli/termines-simple.html`), retenue par le patron : « je choisis la B
 * avec les modifications que je viens de te demander ». La planche reste la
 * référence — toute correction de cet écran s'y porte D'ABORD, sinon les deux
 * divergent, et c'est elle qu'il ouvre sur son téléphone.*
 *
 * **Sa plainte, le 22 août :** *« je la trouve beaucoup trop compliquée. Un
 * utilisateur qui ne connaît pas l'application et qui arrive sur cette page ne
 * comprend rien. »*
 *
 * **Ce qui a quitté l'écran, et pourquoi :**
 *
 *   - le **fil vertical** et ses perles pleines ou creuses — 47 px de largeur
 *     pour un code que personne n'a appris ;
 *   - la **pastille dorée** portant le compte, et le volet **replié** :
 *     le seul travail qui reste ne se cache pas ;
 *   - « **Facturé, tous mois confondus** », qui répétait le chiffre déjà écrit
 *     à droite du mois sans qu'on sache pourquoi c'était le même ;
 *   - le surtitre « CHANTIERS RÉALISÉS » et le cheveu : la planche n'en porte
 *     pas, et le titre suffit.
 *
 * Ce qui reste du pied : le relevé de TVA, devenu **« Ma TVA à déclarer »** —
 * il se consultait sous la barre du bas, coupé en deux.
 */
const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function TerminesPage() {
  const ctx = await getCurrentCtx();
  const chantiers = await listerChantiersTermines(ctx);
  const lignes = preparer(chantiers);
  // **Le mois du jour se décide ICI, sur le serveur.** Calculé dans le
  // navigateur, il pourrait différer de celui du rendu serveur pour qui n'est
  // pas au même fuseau : React refuse alors l'hydratation, et l'écran fige.
  const moisCourant = new Date().toISOString().slice(0, 7);

  // **Ce qu'il reste à payer de TVA, pour la carte en tête — sa demande du
  // 23 août 2026.** Composé une seule fois, dans `src/server/tva-courante.ts` :
  // recomposer ces chiffres ici aurait donné deux additions de la même somme,
  // et deux montants possiblement différents à deux écrans d'intervalle.
  const tva = await tvaDeLaPeriodeCourante(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-10" data-atlas="ecran-termines">
        {/* Ni surtitre ni cheveu : la planche retenue n'en porte pas. */}
        <EnTeteEcran titre="Terminés" cheveu={false} />

        {/* **LA CARTE DE TVA, EN TÊTE — sa demande du 23 août 2026.**

            *« Je trouve que l'outil Ma TVA à déclarer, il est caché, on ne le
            voit pas trop. »* Il vivait tout en bas, après la liste entière ; le
            code assumait cette place — *« le relevé se consulte une fois par
            période »* — et l'argument tenait. Mais il est passé devant sans le
            trouver, et c'est lui qui s'en sert.

            Trois places lui ont été dessinées (`docs/maquettes/86`, essayables
            au doigt). Il a retenu la **B** : pas un lien, mais **ce qu'il vient
            y chercher**. Le montant se lit sans ouvrir.

            **La période est NOMMÉE, et « Reste à payer » aussi** — c'est la
            réserve dite devant la planche avant qu'il ne choisisse : ce montant
            n'est pas dû le jour où il le lit. Il dépend de son rythme et de son
            régime, et n'est exigible qu'à l'échéance. Sans ces deux mots, la
            carte se lirait « ce que je dois aujourd'hui ». */}
        <Link
          href="/termines/tva"
          data-atlas="carte-tva"
          className="mx-[26px] mt-4 flex items-center justify-between gap-3 rounded-[12px] px-[15px] py-[13px]"
          style={{ backgroundColor: colors.card }}
        >
          <span className="min-w-0">
            <span className={`block ${libelleCaps}`} style={{ color: colors.muted }}>
              Ma TVA à déclarer
            </span>
            <span
              className="mt-[3px] block truncate text-[16.5px]"
              style={{ fontFamily: font.display }}
            >
              {tva.periode}
            </span>
          </span>
          <span
            className="shrink-0 text-[21px]"
            style={{ fontFamily: font.display, color: colors.rust, fontVariantNumeric: "tabular-nums" }}
          >
            {formatEuros.format(tva.reste)}
          </span>
        </Link>
        {/* **Cette mention suit le lien où qu'il aille** (`docs/AGENT.md` §6) :
            Atlas prépare le relevé, il ne le déclare pas. « Reste à payer »
            l'accompagne, pour la raison dite plus haut. */}
        <p className="mx-[26px] mt-[6px] text-[11px] leading-[1.6]" style={{ color: colors.muted }}>
          Reste à payer sur la période. Atlas prépare ce relevé, il ne le déclare pas.
        </p>

        {/* **Ce repère existe pour qu'un contrôle puisse mesurer une PLACE.**
            Sa proposition B tient à ce que la carte passe AVANT la liste ; sans
            un repère sur la liste, le contrôle comparait la carte à sa propre
            mention et restait vert la carte remise en pied d'écran — vert sur
            le défaut même dont il portait le nom. */}
        <div data-atlas="contenu-termines">
          {chantiers.length === 0 ? (
            <p className="mt-8 px-[26px] text-[13px] leading-[1.7]" style={{ color: colors.muted }}>
              Vos chantiers apparaîtront ici une fois leur date d&apos;intervention passée.
            </p>
          ) : (
            <ListeTermines lignes={lignes} moisCourant={moisCourant} />
          )}
        </div>

      </div>
    </div>
  );
}
