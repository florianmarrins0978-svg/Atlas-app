import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import { compterLesRetours } from "@/server/repositories/retours-intervention";
import { abonnementDeLEntreprise } from "@/server/repositories/abonnements";
import { fonctionOuverte } from "@/lib/abonnements";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerChantiersTermines } from "@/server/repositories/factures";
import { preparer } from "@/lib/termines-par-mois";
import { jourIso } from "@/lib/jour";
import ListeTermines from "./ListeTermines";
import { listerFacturesNonPayees } from "@/server/repositories/factures-non-payees";
import { facturesAvecPaiements } from "@/server/repositories/paiements-facture";
import { tvaDeLaPeriodeCourante } from "@/server/tva-courante";
import { dossierEnCours as periodeEnCours } from "@/server/repositories/dossiers-comptables";
import { ligneAJustifier, lignesDuReleve } from "@/server/repositories/pour-mon-comptable";
import { garderLaPage } from "@/server/garde-page";

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

export default async function TerminesPage({ searchParams }: { searchParams: Promise<{ chantier?: string }> }) {
  await garderLaPage();
  // La ligne devant laquelle revenir, quand un écran nous y renvoie (le
  // paiement noté, sa demande du 25 septembre 2026).
  const { chantier: chantierDemande } = await searchParams;
  const ctx = await getCurrentCtx();
  const chantiers = await listerChantiersTermines(ctx);
  const lignes = preparer(chantiers);
  // **Le mois du jour se décide ICI, sur le serveur.** Calculé dans le
  // navigateur, il pourrait différer de celui du rendu serveur pour qui n'est
  // pas au même fuseau : React refuse alors l'hydratation, et l'écran fige.
  // Et il se compte à l'heure de son atelier, comme tout jour du dépôt
  // (`jourIso`) : en UTC, le 1ᵉʳ du mois entre minuit et deux heures ouvrait
  // encore sur le mois d'avant.
  const moisCourant = jourIso(new Date()).slice(0, 7);

  // **Ce qu'il reste à payer de TVA, pour la carte en tête — sa demande du
  // 23 août 2026.** Composé une seule fois, dans `src/server/tva-courante.ts` :
  // recomposer ces chiffres ici aurait donné deux additions de la même somme,
  // et deux montants possiblement différents à deux écrans d'intervalle.
  const tva = await tvaDeLaPeriodeCourante(ctx);
  // Le dossier du comptable, sous la carte de la TVA (sa planche du 23 octobre
  // 2026, écran 1) : combien de lignes de banque attendent leur pièce.
  const dossierEnCours = await periodeEnCours(ctx, new Date());
  const sansTicket = (await lignesDuReleve(ctx, dossierEnCours.du, dossierEnCours.au)).filter(ligneAJustifier).length;

  // **Le compte des retours, TOUS mois confondus** — sa règle du 8 septembre
  // 2026 : « il faut pouvoir les garder longtemps ». Le limiter au mois affiché
  // aurait fait disparaître l’onglet un 1er du mois, avec toute l’histoire
  // derrière lui.
  //
  // **Et ZÉRO quand la formule ne les ouvre pas** (« Artisan », 10 septembre
  // 2026) : un point rouge sur un écran qu'on ne peut pas ouvrir est une
  // agression, pas une information. L'onglet, lui, reste (`ListeTermines`).
  const abonnement = await abonnementDeLEntreprise(ctx);
  const retours = fonctionOuverte(abonnement?.formule, "retours") ? await compterLesRetours(ctx) : 0;
  const nonPayees = await listerFacturesNonPayees(ctx);
  // Le même « soldée » que l'écran « Il ne vous paiera pas » lit pour refuser :
  // une seule règle décide si la porte existe et si elle s'ouvre.
  const chantiersSoldes = (await facturesAvecPaiements(ctx)).filter((f) => f.etat === "soldee").map((f) => f.chantierId);

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

            **Elle a porté un contour doré du 26 août au 25 octobre 2026**
            (`appli/termines-sans-traits.html`, proposition 3), pour qu'on voie
            qu'elle s'appuie ; la plage teintée l'a remplacé, voir juste dessous.

            **Ce qui a été écarté, et qu'il ne faut pas ramener :** une flèche au
            bout (*« arrête de mettre des flèches, c'est moche »*, 25 août, redit
            le soir même) et un « Voir le relevé » sous le montant (*« le moins
            de mots possible »*, même jour). */}
        {/* **DEUX PLAGES TEINTÉES, CÔTE À CÔTE — sa planche du 25 octobre 2026**
            (`appli/soignee/termines.html`) : *« garde deux plages teintées
            mais remets le doré de l'appli pour tout ce qui est en doré »*. La
            TVA sur l'or pâle (ce qu'on doit), le comptable sur le vert pâle (ce
            qui est en ordre). Côte à côte, elles tiennent sur une rangée au
            lieu de deux cartes empilées, et la liste remonte.

            **Le contour doré du 26 août est parti avec ce choix.** Il servait à
            dire « on peut appuyer » à une carte du même blanc que l'écran ; une
            plage teintée se détache d'elle-même du fond. Le contrôle
            `test-tva-en-tete-e2e` mesure désormais cela : la carte se voit,
            par son fond. */}
        <div className="mx-[26px] mt-6 grid grid-cols-2 gap-2.5" data-atlas="cases-argent">
          <Link
            href="/termines/tva"
            data-atlas="carte-tva"
            className="flex min-h-[140px] min-w-0 flex-col rounded-[4px] px-3.5 py-4 no-underline"
            style={{ backgroundColor: colors.carteAmbreFond, color: colors.ink }}
          >
            {/* En or et en gras depuis le 23 août 2026 : c'est lui qui nomme
                l'outil qu'il disait « caché ». L'or de l'appli, jamais un or
                foncé : sa correction du 25 octobre. */}
            <span className="block text-[13px] font-bold uppercase leading-[1.35] tracking-[0.1em] [text-wrap:balance]" style={{ color: colors.or }}>
              Ma TVA à déclarer
            </span>
            <span className="mt-1.5 block truncate text-[17px]" style={{ fontFamily: font.display }}>
              {tva.periode}
            </span>
            {/* Le montant se lit sans ouvrir : sa proposition B du 23 août. */}
            <span
              className="mt-auto whitespace-nowrap pt-3.5 text-[24px] leading-none"
              style={{ fontFamily: font.display, fontVariantNumeric: "tabular-nums lining-nums" }}
            >
              {formatEuros.format(tva.reste)}
            </span>
          </Link>
          {/* Le mot du bas dit ce qui manque, en rouille, ou que tout est
              justifié, avec sa coche (sa planche du 23 octobre 2026). */}
          <Link
            href="/termines/comptable"
            data-atlas="carte-comptable"
            className="flex min-h-[140px] min-w-0 flex-col rounded-[4px] px-3.5 py-4 no-underline"
            style={{ backgroundColor: colors.carteVertFond, color: colors.ink }}
          >
            <span className="block text-[13px] font-bold uppercase leading-[1.35] tracking-[0.1em] [text-wrap:balance]" style={{ color: colors.carteVertTexte }}>
              Pour mon comptable
            </span>
            <span className="mt-1.5 block truncate text-[17px]" style={{ fontFamily: font.display }}>
              Dossier en cours
            </span>
            <span
              className="mt-auto flex items-center gap-1.5 pt-3.5 text-[17px] leading-[1.15]"
              style={{ fontFamily: font.display, color: sansTicket > 0 ? colors.rust : colors.ink }}
            >
              {sansTicket === 0 && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-none">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.carteVertTexte} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {sansTicket > 0 ? `${sansTicket} sans ticket` : "Tout est justifié"}
            </span>
          </Link>
        </div>
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
        {/* **La liste se rend même vide — 11 septembre 2026.** L'état « aucun
            chantier terminé » remplaçait la liste entière, et emportait avec
            elle les onglets, « Retours d'intervention » et la porte « Créer une
            facture ». La phrase vit désormais DANS `ListeTermines`, sous les
            onglets, là où elle laisse les portes ouvertes. */}
        <div data-atlas="contenu-termines">
          <ListeTermines
            lignes={lignes}
            retoursNonLus={retours}
            moisCourant={moisCourant}
            nonPayees={nonPayees.length}
            chantierDemande={chantierDemande ?? null}
            chantiersSoldes={chantiersSoldes}
          />
        </div>

      </div>
    </div>
  );
}
