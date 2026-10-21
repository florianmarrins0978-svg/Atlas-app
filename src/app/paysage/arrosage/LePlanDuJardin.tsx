"use client";

import { useMemo, useState } from "react";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import type { EtatPlan } from "./actions";
import type { ParametresPlan } from "@/lib/arrosage/consignes";
import { calculerEtDessiner, montageDuPlan } from "@/lib/arrosage/le-plan";
import { composerLesPostes, metresDeTubeDuReseau, groupeNourrice, groupesDeLaListe, liaisonsDuReseau, listeAuFournisseur, messageAuFournisseur, lignesDeLaDemande, referenceFournisseur, sommeDesGroupes, titreDuDepart, zonesGoutteDuReseau, type Maillon, type Poste, type Robinet } from "@/lib/arrosage/postes";
import {
  RETOUCHES_VIERGES, ajouter, chaineRemettre, chaineRemplacer, chaineRevenir, chaineSupprimer, clesAChanger, ligneRemettre, ligneSupprimer,
  blocRemettre, blocSupprimer, nourriceRemettre, nourriceRemplacer, nourriceSupprimer, oublierLeDepart, remettre, remplacer, revenir, supprimer, type PieceChoisie, type Retouches,
} from "@/lib/arrosage/retouches";
import { lesPrixDe, prixDesFournisseurs, type PrixAchatDuFournisseur } from "@/lib/arrosage/prix-du-plan";

/** Sans ses prix d'achat (un autre rôle, ou une capture), aucun prix : jamais un prix inventé. */
const SANS_PRIX: SesPrix = { fournisseurs: [], achats: [] };

/** Un fournisseur, son adresse, et le début et la fin de SON message (null : ceux d'office). */
export type SonFournisseur = { id: string; nom: string; email: string | null; debut: string | null; fin: string | null };
export type SesPrix = { fournisseurs: SonFournisseur[]; achats: PrixAchatDuFournisseur[] };
import { categorieDe } from "@/lib/arrosage/choix-de-pieces";
import { departDeLOutil, departRetenu, departsPossibles, libelleDepart, phraseDuManque, toutEnGoutteAGoutte, type Depart, type Montage } from "@/lib/arrosage/robinet";
import { ceQueLeTuyauChange, poserLeTuyau, type OuLeTuyau, type Releve } from "@/lib/arrosage/diametre-choisi";
import ChoixDuTuyau from "./ChoixDuTuyau";
import { AjouterUneZone, ModifierLaZone, cotesEcrites } from "./ZonesDuPlan";
import { nomDeLaZone } from "@/lib/arrosage/zones-du-plan";
import PlanDessine, { LegendeDesSymboles } from "./PlanDessine";
import NourriceEclatee from "./NourriceEclatee";
import PiecesDuReseau, { Chips } from "./PiecesDuReseau";
import MontageAuRobinet from "./MontageAuRobinet";
import ListeDesPieces from "./ListeDesPieces";
import MotsDuPlan from "./MotsDuPlan";
import Vignette from "./Vignette";
import { ChoisirUnePiece, FeuilleFournisseur, MenuPiece, type Menu } from "./FeuillePiece";

/**
 * LE PLAN D'ARROSAGE, UNE FOIS LE CROQUIS LU — l'écran qu'il a validé le
 * 18 octobre 2026 (`appli/arrosage-plan.html`) : *« une fois qu'on aura donné le
 * plan d'arrosage, l'endroit où on se repique, la pression, c'est ça que j'ai
 * envie que l'outil me sorte »*.
 *
 * Dans l'ordre de l'eau, son ordre : le piquage (du compteur à la nourrice),
 * la nourrice éclatée, les réseaux un par un sur le plan, les pièces de chaque
 * réseau posées sur le jardin, la liste par nourrice puis réseau, le message au
 * fournisseur, les mots du plan. Et la discussion, en dernier.
 *
 * **Le calcul se rejoue ici, sans serveur**, pour les trois gestes qui le
 * changent (la sonde, la couronne, une ligne ou deux) : `calculerEtDessiner` est
 * la même fonction que celle de l'action serveur. Tout le reste est une
 * RETOUCHE (`retouches.ts`) : changer, supprimer, ajouter, au nombre choisi.
 *
 * **Sur un robinet, ses deux montages** (`appli/arrosage-plan-robinet.html`,
 * validée le 18 octobre 2026 au soir) : le programmateur en nez de robinet,
 * sans nourrice, les réseaux partant du robinet ; ou la nourrice, le robinet
 * pour départ. La double sortie proposée, le départ Ø16, Ø25 ou Ø32 choisi
 * par l'outil et modifiable, la pile du montage sous « Le piquage »
 * (`MontageAuRobinet`, `robinet.ts`).
 */
export default function LePlanDuJardin({
  etat,
  parametres,
  onParametres: setParametres,
  sesPrix = SANS_PRIX,
  surMessageGarde,
}: {
  etat: Pick<Extract<EtatPlan, { etat: "lu" }>, "reserves" | "sansDessin">;
  /**
   * **LES PARAMÈTRES VIVENT CHEZ L'APPELANT** : la lecture du croquis les donne,
   * la discussion les refait, et les cases de cet écran (sonde, couronne, ligne
   * ou boucle) les touchent. Le plan en découle, toujours par la même fonction.
   * Ce composant ne parle à aucun serveur : une capture le rend tel quel.
   */
  parametres: ParametresPlan;
  onParametres: (p: ParametresPlan) => void;
  /**
   * Ses fournisseurs et leurs prix d'achat (Réglages, Fournisseurs et
   * partenaires), passés par l'appelant : ce composant ne parle à aucun
   * serveur. La liste prend les prix du fournisseur de la pastille, par la
   * référence de chaque pièce (`prix-du-plan.ts`), jamais le moins cher.
   */
  sesPrix?: SesPrix;
  /** Son début ou sa fin de message, gardés : l'appelant les retient pour la prochaine ouverture. */
  surMessageGarde?: (id: string, champs: { debut: string | null; fin: string | null }) => void;
}) {
  const [retouches, setRetouches] = useState<Retouches>(RETOUCHES_VIERGES);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [feuille, setFeuille] = useState<{ titre: "Changer la pièce" | "Ajouter une pièce"; categorie: string; onChoix: (p: PieceChoisie) => void } | null>(null);
  const [fournisseur, setFournisseur] = useState(false);
  // La pastille : un fournisseur à la fois, le premier d'office (sa règle du 20 octobre 2026).
  const [vue, setVue] = useState<string | null>(null);
  const [modifier, setModifier] = useState(false);
  // Le tuyau qu'il vient de changer, et le plan d'avant : la phrase compare les deux.
  // La zone dont il corrige les cotes, la place, ou qu'il supprime (« la A », 20 octobre 2026).
  const [zoneOuverte, setZoneOuverte] = useState<number | null>(null);
  const [tuyauChange, setTuyauChange] = useState<{ ou: OuLeTuyau; diametre: 25 | 32; avant: Releve } | null>(null);

  const { plan, dessin } = useMemo(() => calculerEtDessiner(parametres, etat.sansDessin), [parametres, etat.sansDessin]);
  const compteur = parametres.compteur === "oui";
  const amenee = parametres.amenee > 0 ? parametres.amenee : null;
  // Sur un robinet : le montage qu'il a choisi, la double sortie, le départ. Au compteur : rien de tout cela.
  const montage = montageDuPlan(parametres);
  const nez = montage === "nez";
  const double = parametres.robinet?.double ?? false;
  const departChoisi = parametres.robinet?.depart ?? null;
  const robinet = useMemo<Robinet | null>(() => (compteur ? null : { montage, double, depart: departChoisi }), [compteur, montage, double, departChoisi]);
  const depart: Depart | null = robinet ? departRetenu(plan, departChoisi) : null;
  const postes = useMemo(() => composerLesPostes({ plan, dessin, compteur, amenee, robinet, retouches }), [plan, dessin, compteur, amenee, robinet, retouches]);
  const nourrice = groupeNourrice(plan, postes, retouches);
  const groupes = groupesDeLaListe(plan, postes, retouches, compteur, robinet);
  // Le prix de chaque pièce de la liste : chez le fournisseur de la pastille, par sa référence.
  const chezEux = prixDesFournisseurs(
    sommeDesGroupes(groupes).map((l) => ({ ref: l.ref, nom: l.nom, q: l.q, u: l.u, reference: referenceFournisseur(l.ref, plan.materiel) })),
    sesPrix.achats,
    sesPrix.fournisseurs
  );
  const chez = chezEux.find((f) => f.id === vue) ?? chezEux[0];
  const prix = chez ? lesPrixDe(chez) : {};
  const destinataire = chez ? sesPrix.fournisseurs.find((f) => f.id === chez.id) : undefined;
  // Les voies vivantes : un réseau supprimé enlève la sienne (19 octobre 2026).
  const nbGoutte = nourrice.voies.filter((i) => plan.secteurs[i].famille === "Goutte-à-goutte").length;
  // Les réserves du croquis ne bougent pas ; celles du calcul suivent le plan.
  const reserves = [...plan.reserves, ...etat.reserves];

  const r = (f: (r: Retouches) => Retouches) => setRetouches((prev) => f(prev));
  // **LE Ø25 OU LE Ø32, « la C »** (20 octobre 2026) : le calcul refait le plan
  // avec le tuyau choisi, et la phrase dit ce que le jardin y a gagné.
  const choisirLeTuyau = (ou: OuLeTuyau, d: 25 | 32) => {
    setTuyauChange({ ou, diametre: d, avant: { reseaux: plan.secteurs.length, tetes: plan.tetes } });
    setParametres(poserLeTuyau(parametres, ou, d));
  };
  const phraseDuTuyau = (ou: OuLeTuyau) =>
    tuyauChange && tuyauChange.ou === ou ? ceQueLeTuyauChange(tuyauChange.avant, { reseaux: plan.secteurs.length, tetes: plan.tetes }, ou, tuyauChange.diametre) : null;
  // Le goutte-à-goutte seul garde ses départs en Ø16 : là, le choix reste celui des départs.
  const goutteSeule = toutEnGoutteAGoutte(plan);
  const poserRobinet = (patch: Partial<Robinet>) => setParametres({ ...parametres, robinet: { montage, double, depart: departChoisi, ...patch } });
  // Changer de montage change la pile : ses retouches du départ repartent de la
  // proposition, le départ revient à celui de l'outil, et la sonde n'a pas de
  // nourrice où se poser au nez de robinet.
  const changerMontage = (m: Montage) => {
    setParametres({ ...parametres, sonde: m === "nez" ? false : parametres.sonde, robinet: { montage: m, double, depart: null } });
    r((s) => ({ ...oublierLeDepart(s), sonde: m === "nez" ? false : s.sonde }));
  };
  const choisir = (titre: "Changer la pièce" | "Ajouter une pièce", categorie: string, onChoix: (p: PieceChoisie) => void) =>
    setFeuille({ titre, categorie, onChoix: (p) => { onChoix(p); setFeuille(null); } });

  // ── Les menus : ce qu'on peut faire d'une pièce ───────────────────────────
  function menuDeLaPiece(p: Poste) {
    const proposee = p.changee ? postes.compte && nomProposeDe(p) : null;
    setMenu({
      titre: p.nom, proposee, nombre: 1,
      gestes: [
        { libelle: "Changer la pièce", agir: () => choisir("Changer la pièce", categorieDe(p.changee ? nomProposeRef(p) : p.ref), (x) => r((s) => remplacer(s, p.cle, x))) },
        p.retiree
          ? { libelle: "Remettre la pièce", agir: () => r((s) => remettre(s, p.cle)) }
          : { libelle: "Supprimer la pièce", danger: true, agir: () => r((s) => supprimer(s, p.cle)) },
        ...(p.changee ? [{ libelle: "Revenir à la pièce proposée", agir: () => r((s) => revenir(s, p.cle)) }] : []),
      ],
    });
  }
  function menuDeLaNourrice(ref: string, nom: string) {
    const n0 = nourrice.nombre[ref] ?? 1;
    const cle = `nr:${ref}`;
    const restant = n0 - (retouches.nrUne[ref] ?? 0);
    if (n0 > 1 && !retouches.retirees[cle] && !retouches.remplacees[cle]) {
      // Plusieurs exemplaires : il choisit combien (« la A »).
      setMenu({
        titre: nom, proposee: null, nombre: Math.max(restant, 0),
        gestes: [
          ...(restant > 0
            ? [
                { libelle: "Changer", agir: (n: number) => choisir("Changer la pièce", "nourrice", (x) => r((s) => nourriceRemplacer(s, ref, n, x, nourrice.nom, Date.now()))) },
                { libelle: "Supprimer", danger: true, agir: (n: number) => r((s) => nourriceSupprimer(s, ref, n)) },
              ]
            : []),
          ...(retouches.nrUne[ref] ? [{ libelle: `Remettre les ${n0}`, agir: () => r((s) => nourriceRemettre(s, ref)) }] : []),
        ],
      });
      return;
    }
    const changee = retouches.remplacees[cle] ?? null;
    setMenu({
      titre: changee ? changee.nom : nom, proposee: changee ? nom : null, nombre: 1,
      gestes: [
        { libelle: "Changer la pièce", agir: () => choisir("Changer la pièce", "nourrice", (x) => r((s) => remplacer(s, cle, x))) },
        retouches.retirees[cle]
          ? { libelle: "Remettre la pièce", agir: () => r((s) => remettre(s, cle)) }
          : { libelle: "Supprimer la pièce", danger: true, agir: () => r((s) => supprimer(s, cle)) },
        ...(changee ? [{ libelle: "Revenir à la pièce proposée", agir: () => r((s) => revenir(s, cle)) }] : []),
      ],
    });
  }
  function menuDeLaChaine(m: Maillon, nomPropose: string) {
    if (!m.cles.length) return;
    const changee = m.cles.map((c) => retouches.remplacees[c]).find(Boolean) ?? null;
    const otees = m.cles.filter((c) => retouches.retirees[c]).length;
    const vivantes = m.cles.length - otees;
    const refProposee = m.photo ? m.cles[0] : m.cles[0];
    void refProposee;
    setMenu({
      titre: changee ? changee.nom : nomPropose, proposee: changee ? nomPropose : null, nombre: vivantes,
      gestes: [
        ...(vivantes > 0
          ? [
              { libelle: "Changer", agir: (n: number) => choisir("Changer la pièce", categorieDe(refDuMaillon(m)), (x) => r((s) => chaineRemplacer(s, clesAChanger(s, m.cles, n), x))) },
              { libelle: "Supprimer", danger: true, agir: (n: number) => r((s) => chaineSupprimer(s, m.cles, n)) },
            ]
          : []),
        ...(otees ? [{ libelle: `Remettre les ${otees}`, agir: () => r((s) => chaineRemettre(s, m.cles)) }] : []),
        ...(changee ? [{ libelle: "Revenir à la pièce proposée", agir: () => r((s) => chaineRevenir(s, m.cles)) }] : []),
      ],
    });
  }
  /** La référence proposée d'un maillon, pour ouvrir la feuille à la bonne catégorie. */
  function refDuMaillon(m: Maillon): string {
    return { raccord: "te-taraude-25-34-25", sbeb: "SBE-075", pebd: "pebd16", sbeh: "SBE-050", corps: "RT1804" }[m.type];
  }
  function nomProposeDe(p: Poste): string {
    // La pièce proposée se relit dans les postes recomposés SANS la retouche : son nom d'origine.
    const sansCetteRetouche = { ...retouches, remplacees: { ...retouches.remplacees } };
    delete sansCetteRetouche.remplacees[p.cle];
    const origine = composerLesPostes({ plan, dessin, compteur, amenee, robinet, retouches: sansCetteRetouche });
    return trouverPoste(origine, p.cle)?.nom ?? p.nom;
  }
  function nomProposeRef(p: Poste): string {
    const sansCetteRetouche = { ...retouches, remplacees: { ...retouches.remplacees } };
    delete sansCetteRetouche.remplacees[p.cle];
    const origine = composerLesPostes({ plan, dessin, compteur, amenee, robinet, retouches: sansCetteRetouche });
    return trouverPoste(origine, p.cle)?.ref ?? p.ref;
  }

  const texteDesMots = [
    ...plan.secteurs.map((s) => s.nom),
    ...postes.amenee.map((p) => p.nom),
    ...(dessin?.reseaux.flatMap((x) => x.materiels.map((m) => `${m.libelle}${m.bridee ? " bridée" : ""}`)) ?? []),
    ...postes.reseaux.flatMap((x) => [x.compteDuPlan ?? "", ...(x.chaine?.map((m) => m.libelle) ?? []), ...x.rail.map((p) => p.detail)]),
    ...groupes.flatMap((g) => Object.values(g.lignes).map((l) => l.nom)),
  ].join(" ");

  const piquage = nez ? "robinet" : "nourrice";
  const titrePiquage = titreDuDepart(compteur, robinet);

  // La sonde, le grillage et le téflon : cochés, ils se montrent sur une ligne.
  // Au compteur, les trois au-dessus de la nourrice ; au robinet, le grillage
  // et le téflon viennent sous la double sortie, la sonde reste à la nourrice.
  const cocheSonde = <Coche libelle="Sonde de pluie" cochee={Boolean(parametres.sonde)} onChange={(v) => { setParametres({ ...parametres, sonde: v }); r((s) => ({ ...s, sonde: v })); }} />;
  const cochesGrillageTeflon = (
    <>
      <Coche libelle="Grillage avertisseur" cochee={retouches.grillage} onChange={(v) => r((s) => ({ ...s, grillage: v }))} />
      <Coche libelle="Téflon" cochee={retouches.teflon} onChange={(v) => r((s) => ({ ...s, teflon: v }))} />
    </>
  );
  const piecesCochees = (quoi: ("sonde" | "grillage" | "teflon")[]) => {
    const sonde = quoi.includes("sonde") ? postes.sonde : null;
    const grillage = quoi.includes("grillage") ? postes.grillage : null;
    const teflon = quoi.includes("teflon") ? postes.teflon : null;
    if (!sonde && !grillage && !teflon) return null;
    return (
      <>
        <div className="mt-[10px] flex flex-wrap items-start gap-3">
          {sonde && <Vignette poste={sonde} onClick={() => menuDeLaPiece(sonde)} />}
          {grillage && (
            <div className="flex w-[108px] flex-col items-center text-center" data-atlas="grillage">
              <span className="flex h-[88px] w-[88px] items-center justify-center rounded-[12px]" style={{ backgroundColor: colors.card, boxShadow: `0 1px 2px ${colors.line}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- pansement assumé : next/image n’a rien à optimiser sur une photo de pièce servie telle quelle depuis public/, la photo du grillage, validée */}
                <img src="/arrosage-photos/grillage-bleu.jpg" alt="" style={{ maxWidth: 78, maxHeight: 78, mixBlendMode: "multiply" }} />
              </span>
              <span className="mt-[6px] text-[11.5px] leading-[1.3]" style={{ color: colors.inkSoft }}>
                {grillage.q}x {grillage.nom}
              </span>
            </div>
          )}
          {teflon && <Vignette poste={teflon} onClick={() => menuDeLaPiece(teflon)} />}
        </div>
        {grillage && (
          <p className="mt-1 text-[13.5px]" style={{ color: colors.muted }}>
            Rouleau de 100 m. {grillage.detail}
          </p>
        )}
      </>
    );
  };

  return (
    <div data-atlas="plan-arrosage">
      {/* En rouge, vers le début : sa demande du 18 octobre 2026. Les pièces de la
          nourrice se touchent par leur numéro, pas sur le dessin. Sans nourrice,
          pas de numéro à toucher : la phrase ne le dit pas. */}
      <p className="mx-[22px] mt-[10px] text-[14px] font-semibold" style={{ color: colors.alert }}>
        Touchez une pièce pour la changer ou la supprimer.{nez ? "" : " Pour la nourrice, touchez un numéro."}
      </p>

      {/* ─── Le piquage, d'abord : son ordre du 18 octobre ───────────────── */}
      <section className="mx-[22px] mt-[26px]" data-atlas="piquage">
        <span className={`block ${libelleCaps}`} style={{ color: colors.or }}>{compteur ? "Le piquage, au compteur" : "Le piquage, sur un robinet"}</span>
        {robinet && depart && (
          <>
            <Chips valeur={montage} choix={[["nez", "Programmateur en nez de robinet"], ["nourrice", "Avec la nourrice"]]} onChoix={changerMontage} libelle="Le montage" />
            {/* La double sortie est PROPOSÉE, jamais imposée : une sortie pour l'arrosage, l'autre reste au client. */}
            <Coche libelle="Double sortie sous le robinet" cochee={double} onChange={(v) => poserRobinet({ double: v })} />
            <p className="mt-1 text-[13.5px]" style={{ color: colors.muted }}>Une sortie pour l’arrosage, l’autre reste au client.</p>
            {cochesGrillageTeflon}
            {piecesCochees(["grillage", "teflon"])}
            {/* Le départ : l'outil choisit, il peut changer. Le Ø16 ne se propose qu'au goutte-à-goutte seul ;
                dès qu'il y a des arroseurs, c'est le Ø25 ou le Ø32 de « la C », à droite du titre. */}
            {goutteSeule && (
              <>
                <Chips valeur={depart} choix={departsPossibles(plan).map((d) => [d, libelleDepart(d)] as [Depart, string])} onChoix={(d) => poserRobinet({ depart: d })} libelle="Le départ" />
                <p className="mt-1 text-[13.5px]" style={{ color: colors.muted }} data-atlas="depart-choisi">
                  L’outil choisit le {libelleDepart(departDeLOutil(plan))}.{depart !== departDeLOutil(plan) ? " Changé à la main." : ""}
                </p>
              </>
            )}
          </>
        )}
        <div className="mt-4 flex items-center gap-3">
          <h2 className="min-w-0 flex-1" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 21, lineHeight: 1.2 }}>{titrePiquage}</h2>
          {!goutteSeule && <ChoixDuTuyau valeur={plan.tuyau.diametre} onChoix={(d) => choisirLeTuyau("amenee", d)} libelle={`Tuyau, ${titrePiquage.toLowerCase()}`} />}
        </div>
        {phraseDuTuyau("amenee") && (
          <p className="mt-1 text-[14px]" style={{ color: colors.orTexte }} data-atlas="ce-que-le-tuyau-change">{phraseDuTuyau("amenee")}</p>
        )}
        {robinet && depart ? (
          <>
            <MontageAuRobinet postes={postes.amenee.filter((p) => !p.ajoutee)} depart={depart} nez={nez} manque={phraseDuManque(plan, montage)} onPiece={menuDeLaPiece} />
            {postes.amenee.some((p) => p.ajoutee) && (
              <div className="mt-3 flex flex-wrap items-start gap-3">
                {postes.amenee.filter((p) => p.ajoutee).map((p) => (
                  <Vignette key={p.cle} poste={p} onClick={() => menuDeLaPiece(p)} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-4 rounded-[16px] px-3 pb-[14px] pt-[18px]" style={{ backgroundColor: colors.card }}>
            {postes.amenee.map((p) => (
              <Vignette key={p.cle} poste={p} onClick={() => menuDeLaPiece(p)} />
            ))}
          </div>
        )}
        <BoutonAjouter libelle="Ajouter une pièce" onClick={() => choisir("Ajouter une pièce", "reseau", (x) => r((s) => ajouter(s, "amenee", x, Date.now())))} />
        {/* **LE SEUIL DU Ø32 — sa demande du 22 août 2026** : l'outil dit à partir de
            combien de mètres le Ø25 ne tient plus, pas seulement le verdict. Une ligne. */}
        {plan.tuyau.debit > 0 && (plan.tuyau.insuffisantMemeEn32 || plan.tuyau.seuil25 > 0) && (
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: plan.tuyau.insuffisantMemeEn32 ? colors.alert : colors.muted }} data-atlas="seuil-tuyau">
            {plan.tuyau.insuffisantMemeEn32
              ? `${virgule(plan.tuyau.debit)} m³/h sur un réseau : même le Ø32 est trop juste.`
              : `Ø25 jusqu’à ${Math.floor(plan.tuyau.seuil25)} m, Ø32 au-delà.`}
          </p>
        )}
      </section>

      {/* ─── La nourrice — pas au nez de robinet ─────────────────────────── */}
      {!nez && (
        <section className="mx-[22px] mt-[26px]" data-atlas="nourrice">
          <span className={`block ${libelleCaps}`} style={{ color: colors.or }}>La nourrice</span>
          <h2 className="mt-[6px]" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 21, lineHeight: 1.2 }}>{nourrice.nom}</h2>
          <p className="mt-1 text-[13.5px]" style={{ color: colors.muted }}>
            Une voie par réseau, numérotées de gauche à droite après l’arrivée.{nbGoutte ? " Le goutte-à-goutte est à droite." : ""}
          </p>
          {cocheSonde}
          {compteur && cochesGrillageTeflon}
          {piecesCochees(compteur ? ["sonde", "grillage", "teflon"] : ["sonde"])}
          <NourriceEclatee voies={nourrice.voies} nbGoutte={nbGoutte} couleurs={plan.couleurs} retouches={retouches} nombre={nourrice.nombre} onTouche={menuDeLaNourrice} />
        </section>
      )}

      {/* ─── Les réseaux, un par un sur le plan ──────────────────────────── */}
      <section className="mx-[22px] mt-[26px]" data-atlas="reseaux">
        <span className={`block ${libelleCaps}`} style={{ color: colors.or }}>Les réseaux</span>
        <h2 className="mt-[6px]" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 21, lineHeight: 1.2 }}>
          {plan.secteurs.length} réseau{plan.secteurs.length > 1 ? "x" : ""}
          {dessin ? `, ${virgule(dessin.metresTranchee)} m de tranchée` : ""}
        </h2>
        {plan.secteurs.map((s, i) => {
          const rd = dessin?.reseaux.find((x) => x.numero === i) ?? null;
          const pointilles = dessin ? liaisonsDuReseau(dessin, plan, i) : [];
          return (
            <div key={`${s.nom}-${i}`} className="mt-[18px]" data-atlas="carte-reseau">
              <p className="flex items-center gap-2.5">
                <span className="block h-[12px] w-[12px] flex-none rounded-[3px]" style={{ backgroundColor: plan.couleurs[i] }} />
                <b style={{ fontFamily: font.display, fontWeight: 400, fontSize: 18, lineHeight: 1.2 }}>Réseau {i + 1}</b>
                <span className="min-w-0 flex-1 text-[12.5px]" style={{ color: colors.muted }}>{s.nom}</span>
                {/* Le goutte-à-goutte n'a pas de perte de ligne au calcul : le Ø32 n'y changerait rien. */}
                {s.famille !== "Goutte-à-goutte" && (
                  <ChoixDuTuyau valeur={plan.diametres[i] ?? 25} onChoix={(d) => choisirLeTuyau(i, d)} libelle={`Tuyau du réseau ${i + 1}`} />
                )}
              </p>
              {phraseDuTuyau(i) && (
                <p className="mt-1 text-[14px]" style={{ color: colors.orTexte }} data-atlas="ce-que-le-tuyau-change">{phraseDuTuyau(i)}</p>
              )}
              {/* **« Modifier » à droite du nom de chaque zone** — « la A ». Une zone sur
                  deux réseaux s'ouvre sous le premier : deux boîtes pour une zone se contrediraient. */}
              {parametres.zones.filter((z) => (plan.reseauxDeZone[String(z.id)] ?? []).includes(i)).map((z) => (
                <div key={z.id} data-atlas="zone-du-reseau">
                  <p className="mt-1 flex items-center gap-3 text-[14px]">
                    <span className="min-w-0 flex-1" style={{ color: colors.inkSoft }}>{nomDeLaZone(z)}, {cotesEcrites(z)}</span>
                    <button type="button" onClick={() => setZoneOuverte(zoneOuverte === z.id ? null : z.id)} className="min-h-[40px] bg-transparent text-[14.5px] underline" style={{ color: colors.orTexte }} data-atlas="modifier-zone">
                      Modifier
                    </button>
                  </p>
                  {zoneOuverte === z.id && (plan.reseauxDeZone[String(z.id)] ?? [])[0] === i && (
                    <ModifierLaZone key={`${z.id}-${z.L}-${z.l}-${z.ml}`} zone={z} parametres={parametres} onParametres={setParametres} onFermer={() => setZoneOuverte(null)} />
                  )}
                </div>
              ))}
              {dessin && <PlanDessine dessin={dessin} reseau={i} liaisons={pointilles} zonesGoutte={zonesGoutteDuReseau(plan, i)} piquage={piquage} />}
              {pointilles.length > 0 && (
                <p className="mt-2 text-[13px]" style={{ color: colors.inkSoft }}>
                  <svg className="mr-1.5 inline-block align-middle" width="24" height="6" viewBox="0 0 24 6" aria-hidden="true">
                    <line x1="1" y1="3" x2="23" y2="3" stroke={colors.ink} strokeWidth="1.6" strokeDasharray="3 2.4" />
                  </svg>
                  Le passage {nez ? "du robinet" : "de la nourrice"} à « {s.nom} » sort de la pelouse. Le croquis ne montre pas par où il passe (allée, terrasse, bordure). Sa longueur doit être mesurée.
                </p>
              )}
              <ul className="mt-2 list-none p-0 text-[14px]">
                {rd?.materiels.map((m) => (
                  <li key={m.libelle} className="flex gap-2.5 py-[3px]">
                    <span className="w-[58px] flex-none font-semibold tabular-nums" style={{ color: colors.orTexte }}>{m.nombre}x</span>
                    <span>{m.libelle}, {m.bridee ? "bridée à" : "portée"} {virgule(m.portee)} m</span>
                  </li>
                ))}
                {s.famille === "Goutte-à-goutte" && (
                  <li className="flex gap-2.5 py-[3px]">
                    <span className="w-[58px] flex-none" />
                    <span>
                      Goutte-à-goutte Toro, {postes.reseaux[i]?.tube ? `${postes.reseaux[i].tube}, ` : ""}
                      {retouches.sortie === "boucle" ? "deux lignes en circuit fermé" : "une seule ligne"}
                      {`, ${metresDeTubeDuReseau(plan, i)} m de tube`}
                    </span>
                  </li>
                )}
                {rd && (
                  <li className="flex gap-2.5 py-[3px]">
                    <span className="w-[58px] flex-none font-semibold tabular-nums" style={{ color: colors.orTexte }}>{virgule(rd.metresTuyau, 0)} m</span>
                    <span>de PEHD Ø{plan.diametres[i] ?? 25}</span>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
        {/* Une zone que l'IA n'a pas lue s'ajoute ici, puis s'ouvre pour être glissée à sa place. */}
        <AjouterUneZone parametres={parametres} onAjoutee={(p, id) => { setParametres(p); setZoneOuverte(id); }} />
        <div className="mt-3">
          <LegendeDesSymboles robinet={nez} />
        </div>
      </section>

      {/* ─── Les pièces de chaque réseau, posées sur le plan ──────────────── */}
      <section className="mx-[22px] mt-[26px]" data-atlas="pieces">
        <span className={`block ${libelleCaps}`} style={{ color: colors.or }}>Les pièces des réseaux</span>
        {postes.reseaux.map((x) => (
          <PiecesDuReseau
            key={x.i}
            r={x}
            retouches={retouches}
            onPiece={menuDeLaPiece}
            onChaine={menuDeLaChaine}
            onAjouter={(ou) => choisir("Ajouter une pièce", "reseau", (p) => r((s) => ajouter(s, ou, p, Date.now())))}
            onSortie={(v) => { r((s) => ({ ...s, sortie: v })); setParametres({ ...parametres, zones: parametres.zones.map((z) => (z.type === "massif" || z.type === "potager" || z.type === "haie" ? { ...z, sortieGoutte: v } : z)) }); }}
            onCouronne={(v) => { r((s) => ({ ...s, couronne: v })); setParametres({ ...parametres, couronne: v }); }}
          />
        ))}
      </section>

      {/* ─── La liste, et le message au fournisseur ───────────────────────── */}
      <section className="mx-[22px] mt-[26px]" data-atlas="liste">
        <span className={`block ${libelleCaps}`} style={{ color: colors.or }}>La liste</span>
        {chez && chezEux.length > 0 && (
          <Chips valeur={chez.id} choix={chezEux.map((f) => [f.id, f.nom])} onChoix={setVue} libelle="Prix de" />
        )}
        <ListeDesPieces
          groupes={groupes}
          modifier={modifier}
          blocsRetires={retouches.blocsRetires}
          prix={prix}
          chez={chez}
          onBloc={(bloc, oter) => r((s) => (oter ? blocSupprimer(s, bloc) : blocRemettre(s, bloc)))}
          onRetirer={(titre, ref, ligne) => {
            const cle = `${titre}|${ref}`;
            const q = ligne.u === "ml" ? 1 : ligne.q;
            if (q <= 1) { r((s) => ligneSupprimer(s, cle, 1)); return; }
            setMenu({ titre: ligne.nom, proposee: null, nombre: q, gestes: [{ libelle: "Supprimer", danger: true, agir: (n) => r((s) => ligneSupprimer(s, cle, n)) }] });
          }}
          onRemettre={(titre, ref) => r((s) => ligneRemettre(s, `${titre}|${ref}`))}
          onAjouter={(titre) => choisir("Ajouter une pièce", titre === nourrice.nom ? "nourrice" : "reseau", (p) => r((s) => ajouter(s, `liste:${titre}`, p, Date.now())))}
        />
        <button
          type="button"
          onClick={() => setModifier(!modifier)}
          data-atlas="modifier-liste"
          className="mt-4 min-h-[52px] w-full rounded-full text-[16px]"
          style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.card, color: colors.ink }}
        >
          {modifier ? "Terminer" : "Modifier ma liste"}
        </button>
        <button
          type="button"
          onClick={() => setFournisseur(true)}
          data-atlas="envoyer-fournisseur"
          className="atlas-plein mt-[10px] min-h-[52px] w-full rounded-full border-0 text-[16px] font-semibold"
          style={{ backgroundColor: colors.plein, color: colors.card }}
        >
          Envoyer la liste au fournisseur
        </button>
        {/* **CE QUI N'EST PAS CALCULÉ SE DIT SOUS LE PLAN, LÀ OÙ IL LE LIT** (`CLAUDE.md` §4 ter). */}
        {reserves.length > 0 && (
          <ul className="mt-3 list-none p-0" data-atlas="reserves">
            {reserves.map((x, i) => (
              <li key={i} className="flex gap-2.5 py-1 text-[13.5px] leading-[1.45]" style={{ color: colors.ink }}>
                <span aria-hidden="true" className="mt-[7px] h-[7px] w-[7px] flex-none rounded-full" style={{ backgroundColor: colors.alert }} />
                <span className="min-w-0 flex-1">{x}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-[26px]">
        <span className={`mx-[22px] block ${libelleCaps}`} style={{ color: colors.or }}>Les mots du plan</span>
        <MotsDuPlan texte={texteDesMots} />
      </section>

      {menu &&<MenuPiece key={menu.titre + menu.nombre} menu={menu} onFermer={() => setMenu(null)} />}
      {feuille && <ChoisirUnePiece titre={feuille.titre} categorie={feuille.categorie} onChoix={feuille.onChoix} onFermer={() => setFeuille(null)} />}
      {fournisseur && (
        <FeuilleFournisseur
          message={messageAuFournisseur(groupes, plan.materiel)}
          liste={listeAuFournisseur(groupes, plan.materiel)}
          onFermer={() => setFournisseur(false)}
          destinataire={destinataire}
          demande={{ titre: "Plan d’arrosage", lignes: lignesDeLaDemande(groupes, plan.materiel) }}
          surMessageGarde={surMessageGarde}
        />
      )}
    </div>
  );
}

function trouverPoste(postes: ReturnType<typeof composerLesPostes>, cle: string): Poste | null {
  const tous: Poste[] = [...postes.amenee, ...(postes.sonde ? [postes.sonde] : []), ...(postes.teflon ? [postes.teflon] : [])];
  for (const x of postes.reseaux) {
    tous.push(x.pe, ...x.rail, ...x.ajoutees);
    for (const p of x.plan?.poses ?? []) { if (p.egal) tous.push(p.egal); tous.push(...p.pieces); }
  }
  return tous.find((p) => p.cle === cle) ?? null;
}

function virgule(x: number, d = 1) {
  return (Math.round(x * 10 ** d) / 10 ** d).toString().replace(".", ",");
}

function Coche({ libelle, cochee, onChange }: { libelle: string; cochee: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-3 flex items-center gap-3 rounded-full px-4 py-[14px] text-[15px]" style={{ backgroundColor: colors.card, cursor: "pointer" }}>
      <input type="checkbox" checked={cochee} onChange={(e) => onChange(e.target.checked)} className="h-[22px] w-[22px]" style={{ accentColor: colors.plein }} />
      {libelle}
    </label>
  );
}

function BoutonAjouter({ libelle, onClick }: { libelle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-atlas="ajouter-piece"
      className="mt-[10px] flex min-h-[48px] w-full items-center justify-center rounded-full bg-transparent text-[14.5px]"
      style={{ border: `1.5px dashed ${colors.line}`, color: colors.ink }}
    >
      {libelle}
    </button>
  );
}
