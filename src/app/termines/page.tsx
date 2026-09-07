import Link from "next/link";
import { colors, font, libelleCaps, voile } from "@/lib/design-tokens";
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
        <EnTeteEcran titre="Terminés" />

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
            carte se lirait « ce que je dois aujourd'hui ».

            **ELLE PORTE UN CONTOUR DEPUIS LE 26 AOÛT 2026, et c'est son choix
            — la proposition 3** de `appli/termines-sans-traits.html` : *« on ne
            comprend pas trop qu'on peut cliquer dessus, corrige ça, mais garde
            ce style et cette forme, j'aime bien »*.

            **Pourquoi elle ne se voyait pas.** Son fond (`card`, #faf9f5) est à
            deux points du fond de l'écran (`cream`, #f5f3ee). Sans bord, sans
            ombre et sans rien qui ressemble aux boutons du même écran, elle
            avait la forme d'un BANDEAU D'INFORMATION — un chiffre affiché, pas
            un objet qu'on touche. Déplacer la carte en tête le 23 août avait
            réglé « on ne la voit pas » ; restait « on ne sait pas qu'on peut
            appuyer », qui n'est pas la même chose.

            **Un contour, et pas une capsule.** Les deux lui ont été dessinées.
            La capsule aurait réemployé le seul signe du geste que cette page
            connaît déjà ; il a retenu le contour, qui laisse la forme
            rigoureusement intacte.

            **Il est doré, jamais gris.** L'or est déjà la couleur du titre de
            cette carte : un bord gris en aurait fait deux objets — un cadre, et
            un contenu sans rapport. Et il est posé en `boxShadow` interne
            plutôt qu'en `border` : une bordure vraie déplacerait le contenu de
            1,5 px et désalignerait la carte des lignes en dessous.

            **Ce qui a été écarté, et qu'il ne faut pas ramener :** une flèche au
            bout (*« arrête de mettre des flèches, c'est moche »*, 25 août, redit
            le soir même) et un « Voir le relevé » sous le montant (*« le moins
            de mots possible »*, même jour). */}
        <Link
          href="/termines/tva"
          data-atlas="carte-tva"
          // **20 px de haut au lieu de 17, 18 de côté au lieu de 15, et 24 sous
          // le titre au lieu de 18 — « le calme », sa proposition A du
          // 2 septembre 2026** (`appli/termines-elegance.html`). La carte porte
          // un montant de 21 px entre 17 px de marge : le chiffre touchait
          // presque le contour doré, et la carte paraissait pincée là où elle
          // est le premier objet de l'écran. Rien d'autre n'y bouge — ni la
          // forme, ni le fond, ni le contour : *« garde ce style et cette
          // forme, j'aime bien »* (26 août).
          className="mx-[26px] mt-6 flex items-center justify-between gap-3 rounded-[4px] px-[18px] py-5"
          style={{
            backgroundColor: colors.card,
            boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.55)}`,
          }}
        >
          <span className="min-w-0">
            {/* **En or et en gras — sa demande du 23 août 2026 au soir.** Ce
                titre était le plus pâle de la carte alors que c'est lui qui
                nomme l'outil dont il disait, le matin même, *« il est caché, on
                ne le voit pas trop »*. Déplacer la carte en tête ne suffisait
                donc pas : encore fallait-il qu'on la voie. */}
            <span className={`block ${libelleCaps} font-bold`} style={{ color: colors.or }}>
              Ma TVA à déclarer
            </span>
            <span
              className="mt-[5px] block truncate text-[17px]"
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
        {/* **La mention grise sous la carte est partie le 23 août 2026**, à sa
            demande : *« la petite phrase en dessous d'août 2026, en gris,
            supprime-la »*. Cet écran portait trop de choses à lire pour ce
            qu'il vient y faire.

            **Ce que `docs/AGENT.md` §6 exige n'est pas perdu pour autant** —
            Atlas prépare le relevé, il ne le déclare pas —, et c'est la seule
            raison pour laquelle ce retrait est possible : la phrase existe en
            toutes lettres AU BAS DU RELEVÉ lui-même (`termines/tva`), là où les
            chiffres se lisent et où la question se pose. La retirer des deux
            endroits serait autre chose, et se refuserait. */}

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
