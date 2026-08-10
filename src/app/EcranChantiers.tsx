"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, texteSituation } from "@/lib/design-tokens";
import { nombreEnLettres } from "@/lib/nombre-en-lettres";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import FormulaireNouveauChantier from "./chantiers/nouveau/FormulaireNouveauChantier";
import { supprimerChantierAction } from "./planning/actions";
import ListeChantiers, { type BrinChantier } from "./ListeChantiers";

// ─────────────────────────────────────────────────────────────────────────────
// L'écran des chantiers — version retenue par le patron le 10 août 2026.
//
// Il l'a arrêtée après une soirée de maquettes, en nommant ce qu'il gardait :
// la charte Origine, le fil, le trait d'or qui glisse sous les onglets, et
// l'ouverture où « l'écran des chantiers recule et s'assombrit, la feuille
// monte devant lui ».
//
// **Trois choses qu'il a explicitement refusées, et qu'il ne faut pas
// remettre :**
//
//   1. Aucun cheveu entre ATLAS et « Bonjour ». Seul reste celui qui FERME
//      l'en-tête, juste au-dessus de « Nouveau chantier » — celui-là, il l'a
//      demandé deux échanges plus tôt, et les confondre reviendrait à défaire
//      ce qu'il venait de valider.
//   2. Aucune boîte autour d'un chantier. Le fil remplace les cartes.
//   3. Aucune couleur qui ne veuille rien dire. L'or ne se pose que sur ce qui
//      attend un geste de lui.
//
// **Ce qui a disparu, et pourquoi ce n'est pas une perte.** La carte « Équipe »
// au pied de la liste : elle menait aux Réglages, qui sont un onglet du bandeau
// — un raccourci vers l'écran d'à côté. Et la cloche de l'en-tête, qui n'avait
// jamais eu de comportement ; les notifications, elles, restent affichées sous
// le titre, là où elles étaient.
//
// **Rien n'est écrit en dur** : noms, dates, états et compteur viennent tous de
// la base. La maquette ne fixe que la présentation.
// ─────────────────────────────────────────────────────────────────────────────

export default function EcranChantiers({
  prenom,
  chantiers,
  bandeaux,
}: {
  prenom: string | null;
  chantiers: BrinChantier[];
  /** Notifications et annonces, rendues par le serveur et posées sous le titre. */
  bandeaux: ReactNode;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);

  // Le retrait, et le tiroir qui le retient. L'écriture n'a lieu qu'à la
  // fermeture du tiroir : d'ici là la ligne n'est que masquée, et « Annuler »
  // la rend vraiment — elle n'a jamais quitté l'état de l'écran.
  const retraits = useRetraits({
    valider: async (id) => {
      const resultat = await supprimerChantierAction(id);
      // La liste a changé : on la redemande au serveur plutôt que de deviner.
      if (resultat.succes) router.refresh();
      return resultat;
    },
  });

  // **Le décompte suit ce qui reste, sans attendre le serveur.** « Huit en
  // cours » au-dessus de sept lignes ferait douter que le retrait ait eu lieu.
  // Tous les chantiers de la liste n'y entrent pas : `enCours` le dit ligne par
  // ligne, et c'est la seule façon de recompter juste ici.
  const restants = chantiers.filter((c) => !retraits.estRetire(c.id));
  const compte = restants.filter((c) => c.enCours).length;
  const compteEnLettres = nombreEnLettres(compte);

  // Échapper referme, comme partout ailleurs. Sans cela, une personne au
  // clavier se retrouve enfermée dans la feuille.
  useEffect(() => {
    if (!ouvert) return;
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, [ouvert]);

  return (
    <div
      className="atlas-ecran"
      style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }}
    >
      {/* ── L'écran des chantiers ─────────────────────────────────────────
          Il recule et s'assombrit quand la feuille monte : c'est la profondeur
          qui dit « on est passé au-dessus », pas le voile. */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{
          transformOrigin: "50% 44%",
          transform: ouvert ? "scale(0.93) translateY(-10px)" : "none",
          filter: ouvert ? "brightness(0.78)" : "none",
          transition: "transform 560ms cubic-bezier(0.22,0.61,0.36,1), filter 560ms",
        }}
        // Rendu inerte tant que la feuille est ouverte : sans cela, le doigt
        // peut atteindre un chantier à travers le voile.
        aria-hidden={ouvert || undefined}
        inert={ouvert || undefined}
      >
        <p
          className="pt-[26px] text-center text-[11px]"
          style={{ letterSpacing: "0.52em", color: colors.ink }}
        >
          ATLAS
        </p>

        <div className="px-[26px] pt-[34px]">
          {prenom && (
            <p
              className="text-[9.5px] font-medium uppercase"
              style={{ color: colors.or, letterSpacing: "0.28em" }}
            >
              Bonjour {prenom}
            </p>
          )}
          <h1
            className="mt-3.5 whitespace-nowrap text-[36px] leading-[1.02]"
            style={{ fontFamily: font.display, letterSpacing: "-0.018em" }}
          >
            Vos chantiers
          </h1>
          {/* Le compteur, en lettres : un chiffre isolé dans un bandeau de
              capitales se lit comme une donnée de tableau de bord. L'attribut
              sert aux suites de bout en bout — un libellé se réécrit, une
              étiquette de code non. */}
          <p
            data-atlas="compteur"
            data-compte={compte}
            className="mt-3.5 text-[9.5px] font-medium uppercase"
            style={{ color: colors.muted, letterSpacing: "0.28em" }}
          >
            {compteEnLettres} en cours
          </p>
        </div>

        {/* Le seul trait de l'en-tête : celui qui le ferme. */}
        <div className="mx-[26px] mt-[26px] h-px" style={{ backgroundColor: colors.line }} />

        {/* L'action reste un LIEN : sans JavaScript, ou en ouvrant dans un
            nouvel onglet, elle mène à l'écran entier. Le clic ordinaire est
            détourné pour faire monter la feuille — la route ne disparaît pas,
            elle change de porte. */}
        <Link
          href="/chantiers/nouveau"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            setOuvert(true);
          }}
          className="mx-[26px] mt-[22px] flex items-center justify-between gap-4 px-5 py-4 transition-transform active:scale-[0.985]"
          style={{ backgroundColor: colors.rust, color: colors.card, borderRadius: 5 }}
        >
          <span className="text-[18px] leading-tight" style={{ fontFamily: font.display }}>
            Nouveau chantier
          </span>
          <span className="text-[18px] leading-none" style={{ color: colors.orClair }} aria-hidden="true">
            +
          </span>
        </Link>

        <div
          className="mx-[26px] mb-1 mt-[30px] flex justify-between text-[9.5px] font-medium uppercase"
          style={{ color: colors.muted, letterSpacing: "0.28em" }}
        >
          <span>En cours</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{compteEnLettres}</span>
        </div>

        {restants.length === 0 ? (
          <div className="atlas-fil-defile pt-4">
            {bandeaux}
            <p className="px-[26px] pt-2 text-[13px]" style={{ color: colors.muted }}>
              Aucun chantier pour l&apos;instant. Créez votre premier chantier pour commencer.
            </p>
          </div>
        ) : (
          <div className="atlas-fil-defile pb-3 pt-2.5">
            {/* **Les bandeaux défilent AVEC la liste, ils ne la repoussent
                pas.** Posés dans l'en-tête, une notification de trois lignes
                mangeait deux cents pixels : la liste se réduisait à une bande,
                et la perle se retrouvait sous le bord. Le défaut n'était
                visible que sur une capture — la structure semblait juste, et
                les suites étaient vertes. C'est le même défaut qu'en juillet,
                à un autre endroit. */}
            {bandeaux}
            <ListeChantiers
              chantiers={chantiers}
              estRetire={retraits.estRetire}
              onRetirer={retraits.retirer}
            />
          </div>
        )}

        {/* Un refus du serveur ramène la ligne : le dire, sinon elle
            réapparaît sans raison apparente. */}
        {Object.entries(retraits.refuses).map(([id, motif]) => (
          <p
            key={id}
            role="alert"
            className={`px-[26px] pb-2 ${texteSituation}`}
            style={{ color: colors.alert }}
          >
            {motif}
          </p>
        ))}

        {/* Le tiroir est le DERNIER enfant de la colonne : il pousse la liste
            vers le haut au lieu de la recouvrir. Posé par-dessus, il masquerait
            la dernière ligne — celle qu'on vient justement de toucher. */}
        <TiroirDesRetires
          dernier={retraits.dernier}
          nombre={retraits.nombre}
          onAnnuler={retraits.annuler}
        />
      </div>

      {/* ── Le voile ──────────────────────────────────────────────────────
          Il assombrit à peine : c'est le recul de l'écran qui porte la
          profondeur. Il sert surtout de cible pour refermer d'un doigt. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setOuvert(false)}
        className="fixed inset-0 z-[45]"
        style={{
          backgroundColor: "rgba(20,18,14,0.12)",
          opacity: ouvert ? 1 : 0,
          visibility: ouvert ? "visible" : "hidden",
          transition: ouvert
            ? "opacity 460ms, visibility 0s 0s"
            : "opacity 460ms, visibility 0s 460ms",
        }}
      />

      {/* ── La feuille ────────────────────────────────────────────────────
          Elle s'arrête à 60 px du haut : l'écran des chantiers reste visible
          derrière, et l'on sait d'où l'on vient. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nouveau chantier"
        // `fixed`, et non `absolute` : la feuille doit RECOUVRIR le bandeau du
        // bas et la bulle de l'assistant, qui sont fixés au-dessus de l'écran.
        // En absolu elle passait dessous, et sa dernière ligne — celle qui
        // prévient que les coordonnées ne seront plus modifiables — se
        // retrouvait cachée derrière les onglets.
        className="fixed inset-x-0 bottom-0 top-[60px] z-[50] mx-auto flex max-w-md flex-col overflow-hidden"
        style={{
          backgroundColor: colors.cream,
          borderRadius: "26px 26px 0 0",
          boxShadow: "0 -22px 50px rgba(20,18,14,0.22)",
          transform: ouvert ? "translateY(0)" : "translateY(100%)",
          visibility: ouvert ? "visible" : "hidden",
          transition: ouvert
            ? "transform 560ms cubic-bezier(0.22,0.61,0.36,1), visibility 0s 0s"
            : "transform 560ms cubic-bezier(0.22,0.61,0.36,1), visibility 0s 560ms",
        }}
        inert={!ouvert || undefined}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Remonté à la fermeture : le formulaire garde son état tant qu'il
              est monté, et rouvrir une feuille encore remplie de la saisie
              précédente est le meilleur moyen de créer un chantier en double.
              La clé change à chaque ouverture, donc l'état repart à zéro. */}
          {ouvert && (
            <FormulaireNouveauChantier
              enFeuille
              onFermer={() => {
                setOuvert(false);
                // La liste peut avoir changé pendant que la feuille était
                // ouverte : on la redemande au serveur plutôt que d'espérer.
                router.refresh();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
