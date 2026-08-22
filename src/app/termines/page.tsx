import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerChantiersTermines } from "@/server/repositories/factures";
import { preparer } from "@/lib/termines-par-mois";
import ListeTermines from "./ListeTermines";

export const dynamic = "force-dynamic";

/**
 * « Terminés » — un mois à la fois, et l'état écrit en toutes lettres.
 *
 * *Refait le 22 août 2026 d'après la planche 89, proposition B
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
export default async function TerminesPage() {
  const ctx = await getCurrentCtx();
  const chantiers = await listerChantiersTermines(ctx);
  const lignes = preparer(chantiers);
  // **Le mois du jour se décide ICI, sur le serveur.** Calculé dans le
  // navigateur, il pourrait différer de celui du rendu serveur pour qui n'est
  // pas au même fuseau : React refuse alors l'hydratation, et l'écran fige.
  const moisCourant = new Date().toISOString().slice(0, 7);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-10" data-atlas="ecran-termines">
        {/* Ni surtitre ni cheveu : la planche retenue n'en porte pas. */}
        <EnTeteEcran titre="Terminés" cheveu={false} />

        {chantiers.length === 0 ? (
          <p className="mt-8 px-[26px] text-[13px] leading-[1.7]" style={{ color: colors.muted }}>
            Vos chantiers apparaîtront ici une fois leur date d&apos;intervention passée.
          </p>
        ) : (
          <ListeTermines lignes={lignes} moisCourant={moisCourant} />
        )}

        {/* **Le relevé se consulte une fois par période** : il n'a rien à faire
            en tête d'écran, et il ne doit pas non plus finir collé à la barre du
            bas, où il se lisait coupé en deux. */}
        <div className="mx-[26px] mt-[26px] pt-1.5" style={{ borderTop: `1px solid ${colors.line}` }}>
          <Link
            href="/termines/tva"
            className="flex min-h-[52px] items-center justify-between gap-3.5 py-2"
          >
            <span style={{ fontFamily: font.display, fontSize: 16, lineHeight: 1.25 }}>
              Ma TVA à déclarer
            </span>
            <span aria-hidden="true" className="text-[15px]" style={{ color: colors.or }}>
              ›
            </span>
          </Link>
          {/* **Cette mention reste, où que le relevé aille** (`docs/AGENT.md`
              §6) : Atlas le prépare, il ne le déclare pas. Le relevé est
              calculé à la demande, jamais stocké. */}
          <p className="pb-2 text-[11px] leading-[1.6]" style={{ color: colors.muted }}>
            Atlas prépare ce relevé, il ne le déclare pas.
          </p>
        </div>
      </div>
    </div>
  );
}
