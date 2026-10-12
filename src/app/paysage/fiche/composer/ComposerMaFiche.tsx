"use client";

import { useRef, useState } from "react";
import { cardShadow, colors, font, libelleCaps, radius, texteSituation } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import { modeleManquant, modeleRemis, parFamilles } from "@/lib/prestations-entretien";
import {
  ajouterPrestationAction,
  remettreLeModeleAction,
  renommerFamilleAction,
  renommerPrestationAction,
  retirerFamilleAction,
  retirerPrestationAction,
} from "./actions";

// L'écran où la fiche d'entretien se compose — planche
// `docs/maquettes/64-composer-sa-fiche.html`, retenue le 16 août 2026.
//
// **Un seul modèle**, dans ses mots : « il n'y aura qu'une seule fiche ». Rien
// n'est rangé par client ; à chaque passage, la fiche partira de là.
//
// **Le retrait est réversible** (`useRetraits`, sa règle du 10 août) : la ligne
// se barre, le tiroir propose « Annuler », et rien n'est écrit tant qu'il est
// ouvert. Une croix nue sur une liste qu'il a mis vingt minutes à composer
// serait le geste le plus coûteux de cet écran.
//
// **LES CATÉGORIES SE FONT ET SE DÉFONT ICI — corrigé le 24 août 2026.** Sa
// description de l'écran : *« ajouter des catégories, en enlever, en créer »*.
// Aucun des deux verbes qui comptent ne tenait :
//
//   * « en créer » ouvrait une prestation dans « Divers », à charge pour lui de
//     renommer la famille juste au-dessus. Le bouton promettait une famille et
//     livrait un rangement par défaut, plus un second geste à deviner ;
//   * « en enlever » n'existait pas : il fallait retirer six prestations une à
//     une, avec des gants, et la famille tombait quand la dernière tombait.
//
// Le nom de la famille se saisit donc AVEC sa première prestation, et un bouton
// « Retirer la famille » l'emporte entière — par le même tiroir que les lignes,
// jamais par un geste neuf. **Nommé, et non dessiné en croix** : voir ce bouton
// plus bas, une capture a montré pourquoi.

export type PrestationAffichee = { id: string; famille: string; libelle: string };

/**
 * Ce qui distingue, dans le tiroir, le retrait d'une FAMILLE de celui d'une
 * ligne.
 *
 * `useRetraits` ne connaît que des identifiants ; une famille n'en a pas — elle
 * est une colonne de texte (`renommerFamille`). Ce préfixe lui en fabrique un,
 * et il ne peut pas se confondre avec un identifiant de prestation, qui est un
 * UUID sans deux-points.
 */
const PREFIXE_FAMILLE = "famille:";

export default function FicheEntretienClient({
  prestationsInitiales,
}: {
  prestationsInitiales: PrestationAffichee[];
}) {
  const [prestations, setPrestations] = useState(prestationsInitiales);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState<string | null>(null);
  const [saisie, setSaisie] = useState("");
  /** Le nom de la catégorie qu'il est en train de créer — vide le reste du temps. */
  const [saisieFamille, setSaisieFamille] = useState("");

  /** Les lignes que « Remettre le modèle Atlas » vient de poser, le temps d'« Annuler ». */
  const [remises, setRemises] = useState<string[] | null>(null);
  const minuteurRemis = useRef<ReturnType<typeof setTimeout> | null>(null);

  const retraits = useRetraits({
    valider: async (id) => {
      // Une famille ou une ligne : le préfixe tranche, et l'écriture qui suit
      // n'est pas la même. Deux tiroirs auraient été deux « Annuler » à
      // l'écran, dont un seul aurait porté le dernier geste.
      if (id.startsWith(PREFIXE_FAMILLE)) {
        const famille = id.slice(PREFIXE_FAMILLE.length);
        const r = await retirerFamilleAction(famille);
        if (!r.ok) return { succes: false, erreur: r.phrase };
        setPrestations((cur) =>
          cur.filter((p) => p.famille.toLowerCase() !== famille.toLowerCase())
        );
        return { succes: true };
      }
      const r = await retirerPrestationAction(id);
      if (!r.ok) return { succes: false, erreur: r.phrase };
      setPrestations((cur) => cur.filter((p) => p.id !== id));
      return { succes: true };
    },
  });

  // Une prestation disparaît de l'écran pour deux raisons : elle a été retirée,
  // ou SA FAMILLE l'a été. Oublier la seconde laisserait six lignes orphelines
  // sous un titre qu'on vient de faire disparaître.
  const visibles = prestations.filter(
    (p) => !retraits.estRetire(p.id) && !retraits.estRetire(PREFIXE_FAMILLE + p.famille)
  );
  const familles = parFamilles(visibles);

  async function ajouter(famille: string) {
    const libelle = saisie;
    if (!libelle.trim()) {
      setAjoutOuvert(null);
      setSaisie("");
      return;
    }
    const r = await ajouterPrestationAction(famille, libelle);
    if (!r.ok) {
      setPhrase(r.phrase);
      return;
    }
    setPhrase(null);
    setSaisie("");
    setSaisieFamille("");
    setAjoutOuvert(null);
    // **Rechargé depuis le serveur plutôt que deviné ici.** L'ordre d'insertion
    // — à la fin de SA famille — est une règle du dépôt, et la recopier dans
    // l'écran donnerait deux vérités sur la place de la ligne (`CLAUDE.md` §3).
    location.reload();
  }

  /**
   * Crée une famille et sa première prestation, en un geste.
   *
   * **Séparée d'`ajouter`, et il le fallait** : celle-ci referme le panneau en
   * silence quand le champ est vide — c'est sa façon d'annuler. Le même
   * raccourci ici perdrait le nom de famille qu'il vient de taper, sans un mot.
   * Les deux refus — famille vide, prestation vide — remontent donc du dépôt
   * avec leur phrase (`PHRASE_REFUS`), plutôt que d'être rejugés ici.
   */
  async function creerFamille() {
    const r = await ajouterPrestationAction(saisieFamille, saisie);
    if (!r.ok) {
      setPhrase(r.phrase);
      return;
    }
    setPhrase(null);
    setSaisie("");
    setSaisieFamille("");
    setAjoutOuvert(null);
    location.reload();
  }

  /**
   * « Remettre le modèle Atlas » — sa réponse « B » du 29 septembre 2026 : ce
   * qui manque du modèle revient dans sa famille, ses lignes à lui restent.
   *
   * **Les retraits en attente s'écrivent d'abord.** Sinon le serveur verrait
   * encore la ligne qu'il vient de retirer, ne la remettrait pas, et le retrait
   * l'effacerait juste après : le bouton aurait menti.
   *
   * La fiche remise se recompose ICI avec la même règle que le dépôt
   * (`modeleRemis`), les identifiants venant du serveur : un rechargement
   * emporterait le « Annuler », qui vit dans cet écran.
   */
  async function remettre() {
    // La fiche telle qu'il la voit : sans les lignes du tiroir, qui vont
    // s'écrire. `prestations` lu après l'attente serait celui d'avant.
    const avant = visibles;
    await retraits.fermer();
    const r = await remettreLeModeleAction();
    if (!r.ok) {
      setPhrase(r.phrase);
      return;
    }
    setPhrase(null);
    if (r.ajoutees.length === 0) return;
    // Chaque ligne remise retrouve son identifiant par son libellé. S'il en
    // manquait un, l'écran et la base ne diraient plus la même chose : la page
    // se relit plutôt que d'afficher une ligne qu'aucun « Retirer » ne pourrait viser.
    const fiche = modeleRemis(avant);
    const complete = fiche.map((l) => ("id" in l ? l : r.ajoutees.find((a) => a.libelle === l.libelle)));
    if (complete.some((l) => l === undefined)) {
      location.reload();
      return;
    }
    setPrestations(complete.filter((l): l is PrestationAffichee => l !== undefined));
    if (minuteurRemis.current) clearTimeout(minuteurRemis.current);
    setRemises(r.ajoutees.map((a) => a.id));
    minuteurRemis.current = setTimeout(() => setRemises(null), 6000);
  }

  /** « Annuler » : les lignes remises repartent, et elles seules. */
  async function annulerRemise() {
    const ids = remises ?? [];
    if (minuteurRemis.current) clearTimeout(minuteurRemis.current);
    setRemises(null);
    for (const id of ids) {
      const r = await retirerPrestationAction(id);
      if (!r.ok) {
        setPhrase(r.phrase);
        return;
      }
    }
    setPrestations((cur) => cur.filter((p) => !ids.includes(p.id)));
  }

  async function renommer(id: string, avant: string, apres: string) {
    if (apres.trim() === "" || apres === avant) return;
    const r = await renommerPrestationAction(id, apres);
    if (!r.ok) {
      setPhrase(r.phrase);
      return;
    }
    setPhrase(null);
    setPrestations((cur) => cur.map((p) => (p.id === id ? { ...p, libelle: apres } : p)));
  }

  async function renommerLaFamille(ancienne: string, nouvelle: string) {
    if (nouvelle.trim() === "" || nouvelle === ancienne) return;
    const r = await renommerFamilleAction(ancienne, nouvelle);
    if (!r.ok) {
      setPhrase(r.phrase);
      return;
    }
    setPhrase(null);
    setPrestations((cur) =>
      cur.map((p) => (p.famille === ancienne ? { ...p, famille: nouvelle } : p))
    );
  }

  // ─── La fiche composée ─────────────────────────────────────────────────────
  //
  // **Planche du 11 octobre 2026** (`appli/fiche-de-chantier-composer.html`,
  // version Corrigé) : une carte par famille, une rangée de familles collée en
  // haut pour sauter de l'une à l'autre, et « Retirer » en toutes lettres à la
  // place des croix. Vingt lignes à plat se parcouraient au pouce, du haut en
  // bas, pour atteindre « Propreté ».
  return (
    <div className="pb-10">
      {/* **Le compte vit ICI, sous le titre, et il suit l'écran** : planche du
          11 octobre 2026, qui montre « 19 prestations » juste après un
          retrait. Posé par le serveur, il dirait encore 20 pendant que le
          tiroir propose « Annuler ».

          **Ce n'est pas la phrase grise du 27 août qui revient** (*« supprime
          la phrase en gris sous composer ma fiche »*) : celle-là expliquait
          l'écran ; celle-ci est un compte, comme sur la carte qui mène ici. */}
      <EnTeteEcran
        surtitre="Outils du métier"
        titre="Composer ma fiche"
        precision={`${visibles.length} prestation${visibles.length > 1 ? "s" : ""}`}
        retour={{ href: "/paysage/fiche", libelle: "Retour à la fiche de chantier" }}
      />

      {/* **La rangée des familles, collée en haut.** Une pastille par famille,
          lue dans SES données (`parFamilles`) : une famille qu'il crée demain y
          entre toute seule. Des boutons et non des ancres : l'adresse de la
          page ne change pas, et la flèche de retour ramène aux fiches, pas à
          « Pelouse ». */}
      {familles.length > 0 && (
        <nav
          aria-label="Familles"
          data-atlas="familles-de-la-fiche"
          className="sticky top-0 z-[4] mt-[16px] flex gap-[6px] overflow-x-auto px-[26px] pb-[12px] pt-[16px]"
          style={{ backgroundColor: colors.cream, boxShadow: `0 1px 0 ${colors.line}`, scrollbarWidth: "none" }}
        >
          {familles.map((f, rang) => (
            <button
              key={f.famille}
              type="button"
              onClick={() =>
                document.getElementById(`famille-${rang}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="flex min-h-[44px] flex-none items-center rounded-full px-[14px] text-[14px]"
              style={{ backgroundColor: colors.rustTint, color: colors.rust }}
            >
              {f.famille}
            </button>
          ))}
        </nav>
      )}

      <div className="px-[26px]">
        {phrase && (
          <p
            className="mt-4 text-[14px]"
            style={{ color: colors.rust }}
            role="alert"
            data-refus
          >
            {phrase}
          </p>
        )}

        {familles.map((f, rang) => (
          <section
            key={f.famille}
            id={`famille-${rang}`}
            data-atlas="carte-famille"
            className="mt-[18px] px-[18px] pb-[6px] pt-[16px]"
            // La marge de défilement laisse la rangée collée au-dessus du nom
            // de la famille : sans elle, l'appui sur une pastille cacherait
            // justement le titre qu'on venait chercher.
            style={{ backgroundColor: colors.card, borderRadius: radius.card, boxShadow: cardShadow, scrollMarginTop: 84 }}
          >
            {/* La famille se renomme sur place : c'est son mot, pas une
                nomenclature imposée. En serif, comme un nom : c'est le titre
                de sa carte. */}
            <input
              defaultValue={f.famille}
              aria-label={`Nom de la famille ${f.famille}`}
              data-famille={f.famille}
              onBlur={(e) => renommerLaFamille(f.famille, e.target.value)}
              className="block w-full bg-transparent text-[21px] leading-[1.2] outline-none"
              style={{ color: colors.ink, border: "none", padding: 0, fontFamily: font.display }}
            />
            <p className={`mt-[4px] mb-[6px] ${texteSituation}`} style={{ color: colors.inkSoft }}>
              {f.lignes.length} prestation{f.lignes.length > 1 ? "s" : ""}
            </p>

            {f.lignes.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-[10px]"
                style={{ borderBottom: `1px solid ${colors.line}` }}
              >
                <input
                  defaultValue={p.libelle}
                  aria-label={`Prestation ${p.libelle}`}
                  data-prestation={p.id}
                  onBlur={(e) => renommer(p.id, p.libelle, e.target.value)}
                  className="min-h-[50px] min-w-0 flex-1 bg-transparent text-[16px]"
                  style={{ color: colors.ink, border: "none", padding: 0 }}
                />
                {/* « Retirer » et non plus « × » : le mot du reste de
                    l'application, et le même tiroir « Annuler ». 44 px : la
                    mesure d'un doigt. */}
                <button
                  type="button"
                  aria-label={`Retirer ${p.libelle}`}
                  onClick={() => retraits.retirer(p.id, `« ${p.libelle} »`)}
                  className={`flex min-h-[44px] min-w-[44px] flex-none items-center justify-end pl-[12px] ${libelleCaps}`}
                  style={{ color: colors.inkSoft }}
                >
                  Retirer
                </button>
              </div>
            ))}

            {ajoutOuvert === f.famille ? (
              <div className="py-3">
                <input
                  autoFocus
                  value={saisie}
                  onChange={(e) => setSaisie(e.target.value)}
                  placeholder="Nom de la prestation"
                  aria-label={`Nouvelle prestation dans ${f.famille}`}
                  className="w-full rounded-[10px] px-3 py-3 text-[16px]"
                  style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
                />
                <div className="mt-3">
                  <PrimaryButton onClick={() => ajouter(f.famille)}>Ajouter à {f.famille}</PrimaryButton>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-[10px]">
                <button
                  type="button"
                  className="min-h-[44px] whitespace-nowrap text-left text-[14px]"
                  style={{ color: colors.or }}
                  onClick={() => {
                    setSaisie("");
                    setAjoutOuvert(f.famille);
                  }}
                >
                  + Ajouter une prestation
                </button>
                {/* **AU PIED DE SA CARTE**, planche du 11 octobre 2026 : posé
                    contre le nom, il se lisait comme le geste du titre ; ici,
                    il se lit après les lignes qu'il emporte.

                    **CE BOUTON S'ÉCRIT, il ne se dessine pas** — une capture du
                    24 août 2026 l'a imposé : en croix, il était le jumeau exact
                    de celui des lignes, et rien ne disait que l'un retire une
                    prestation et l'autre en emporte six. Le compte est DANS le
                    libellé lu à voix haute, pour la même raison. */}
                <button
                  type="button"
                  aria-label={`Retirer la famille ${f.famille} et ses ${f.lignes.length} prestation${f.lignes.length > 1 ? "s" : ""}`}
                  data-retirer-famille={f.famille}
                  onClick={() =>
                    retraits.retirer(
                      PREFIXE_FAMILLE + f.famille,
                      `« ${f.famille} » et ses ${f.lignes.length} prestation${f.lignes.length > 1 ? "s" : ""}`
                    )
                  }
                  className={`ml-auto flex min-h-[44px] flex-none items-center whitespace-nowrap pl-[8px] ${libelleCaps}`}
                  style={{ color: colors.inkSoft }}
                >
                  Retirer la famille
                </button>
              </div>
            )}
          </section>
        ))}

        {/* Une famille neuve naît d'une prestation : une famille vide n'aurait
            rien à cocher, et il faudrait la ramasser plus tard. **Mais elle se
            NOMME ici**, dans le même geste : jusqu'au 24 août 2026, ce bouton
            rangeait la ligne dans « Divers » et lui laissait renommer la famille
            au-dessus — un second geste que rien n'annonçait, sur un bouton qui
            promettait une famille. */}
        {ajoutOuvert === "__neuve__" ? (
          <div className="mt-[22px]">
            <input
              autoFocus
              value={saisieFamille}
              onChange={(e) => setSaisieFamille(e.target.value)}
              placeholder="Nom de la famille"
              aria-label="Nom de la nouvelle famille"
              data-nouvelle-famille
              className="w-full rounded-[10px] px-3 py-3 text-[16px]"
              style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
            />
            <input
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Sa première prestation"
              aria-label="Première prestation de la nouvelle famille"
              className="mt-3 w-full rounded-[10px] px-3 py-3 text-[16px]"
              style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
            />
            <div className="mt-3">
              <PrimaryButton onClick={creerFamille}>Créer la famille</PrimaryButton>
            </div>
            <p className="mt-2 text-[13px]" style={{ color: colors.muted }}>
              Vous ajouterez ses autres prestations juste après.
            </p>
          </div>
        ) : (
          <button
            type="button"
            className="mt-[22px] min-h-[44px] text-[14px]"
            style={{ color: colors.or }}
            onClick={() => {
              setSaisie("");
              setSaisieFamille("");
              setAjoutOuvert("__neuve__");
            }}
          >
            + Ajouter une famille
          </button>
        )}

        {/* **Le bouton des messages préremplis, pour la fiche** — sa demande du
            29 septembre 2026 : *« il doit pouvoir la remettre en cliquant sur une
            touche, comme on fait pour les messages préremplis envoyés par SMS »*.
            Même dessin que « Remettre le message d'Atlas » (`MessagesClient.tsx`),
            et, comme lui, montré seulement quand il y a quelque chose à remettre. */}
        {modeleManquant(visibles).length > 0 && (
          <button
            type="button"
            data-atlas="remettre-modele"
            onClick={() => void remettre()}
            className="mt-[18px] block min-h-[44px] rounded-full px-[18px] text-[14px]"
            style={{ color: colors.inkSoft, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          >
            Remettre le modèle Atlas
          </button>
        )}

        <p className="mt-[26px] text-[13.5px] leading-[1.6]" style={{ color: colors.inkSoft }}>
          Modifier cette fiche ne change <b style={{ color: colors.ink, fontWeight: 600 }}>aucun rapport déjà envoyé</b>.
        </p>
      </div>

      {/* Hors de la marge de 26 px : les tiroirs la portent déjà, et
          l'imbriquer la doublerait (`FichesEnCours`). */}
      {remises && (
        <div
          className="atlas-tiroir mx-[26px]"
          data-ouvert="oui"
          data-atlas="modele-remis"
          style={{ borderTopColor: colors.line }}
          aria-live="polite"
        >
          <span className={texteSituation} style={{ color: colors.muted }}>
            Modèle remis
          </span>
          <button
            type="button"
            onClick={() => void annulerRemise()}
            aria-label="Annuler la remise du modèle"
            className={`-mr-2 px-2 py-2 ${libelleCaps}`}
            style={{ color: colors.or, letterSpacing: "0.24em" }}
          >
            Annuler
          </button>
        </div>
      )}

      <TiroirDesRetires
        dernier={retraits.dernier}
        nombre={retraits.nombre}
        onAnnuler={retraits.annuler}
      />
    </div>
  );
}
