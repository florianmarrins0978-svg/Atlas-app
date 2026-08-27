"use client";

import { useState } from "react";
import { colors, libelleCaps, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import { parFamilles, type PrestationModele } from "@/lib/prestations-entretien";
import {
  ajouterPrestationAction,
  poserModeleFourniAction,
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
  modeleFourni,
}: {
  prestationsInitiales: PrestationAffichee[];
  /** Ce que « Partir du modèle Atlas » poserait — montré avant d'appuyer. */
  modeleFourni: readonly PrestationModele[];
}) {
  const [prestations, setPrestations] = useState(prestationsInitiales);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState<string | null>(null);
  const [saisie, setSaisie] = useState("");
  /** Le nom de la catégorie qu'il est en train de créer — vide le reste du temps. */
  const [saisieFamille, setSaisieFamille] = useState("");

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

  // ─── La fiche vide : on propose, on ne pose pas ────────────────────────────
  //
  // Semer vingt lignes parce qu'il a ouvert un écran serait écrire en base pour
  // un regard. Il voit donc ce que le modèle contient, et il appuie — ou non.
  if (prestations.length === 0) {
    return (
      <div className="px-6 pb-10">
        <p className="text-[15px] leading-relaxed" style={{ color: colors.muted }}>
          Votre fiche d&apos;entretien est vide. C&apos;est la liste que vous cocherez sur un
          chantier, et dont votre client recevra le rapport.
        </p>

        <div className="mt-5 rounded-[14px] p-5" style={{ backgroundColor: colors.card }}>
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
            Le modèle Atlas — {modeleFourni.length} prestations
          </p>
          <p className="text-[14px] leading-relaxed" style={{ color: colors.ink }}>
            {modeleFourni.map((p) => p.libelle).join(" · ")}
          </p>
          <p className="mt-3 text-[13px]" style={{ color: colors.muted }}>
            Rien n&apos;est figé : vous retirez, ajoutez et renommez ce que vous voulez ensuite.
          </p>
        </div>

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

        <div className="mt-5">
          <PrimaryButton
            onClick={async () => {
              const r = await poserModeleFourniAction();
              if (!r.ok) setPhrase(r.phrase);
              else location.reload();
            }}
          >
            Partir du modèle Atlas
          </PrimaryButton>
        </div>

        <button
          type="button"
          className="mt-3 block w-full text-center text-[14px]"
          style={{ color: colors.or }}
          onClick={() => {
            setSaisie("");
            setSaisieFamille("");
            setAjoutOuvert("__neuve__");
          }}
        >
          Je préfère composer la mienne
        </button>

        {/* La toute première ligne se range dans une famille qu'il NOMME, comme
            toutes celles d'après : le faire tomber dans « Divers » lui donnerait
            un mot qui n'est pas le sien sur la première chose qu'il écrit. */}
        {ajoutOuvert && (
          <div className="mt-4">
            <input
              autoFocus
              value={saisieFamille}
              onChange={(e) => setSaisieFamille(e.target.value)}
              placeholder="Pelouse"
              aria-label="Nom de la première famille"
              data-nouvelle-famille
              className="w-full rounded-[10px] px-3 py-3 text-[16px]"
              style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
            />
            <input
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Tonte et ébarbage"
              aria-label="Nom de la première prestation"
              className="mt-3 w-full rounded-[10px] px-3 py-3 text-[16px]"
              style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
            />
            <div className="mt-3">
              <PrimaryButton onClick={creerFamille}>Ajouter</PrimaryButton>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── La fiche composée ─────────────────────────────────────────────────────
  return (
    <div className="px-6 pb-10">
      {/* **PLUS DE PHRASE GRISE SOUS LE TITRE** — sa demande du 27 août 2026 :
          *« supprime la phrase en gris sous composer ma fiche »*.

          Elle disait « n prestations, rangées par famille. C'est cette liste que
          vous cocherez sur un chantier. » — c'est-à-dire un écran qui explique
          son propre fonctionnement, ce que sa consigne du 25 août interdit
          (`CLAUDE.md` §3) : les familles sont sous les yeux, et le compte est
          déjà sur la carte qui mène ici. */}
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

      {familles.map((f) => (
        <section key={f.famille} className="mt-6">
          {/* La famille se renomme sur place : c'est son mot, pas une
              nomenclature imposée. Et elle se retire d'un geste — avant le
              24 août 2026, il fallait vider ses six lignes une par une. */}
          <div className="flex items-center gap-3">
            <input
              defaultValue={f.famille}
              aria-label={`Nom de la famille ${f.famille}`}
              data-famille={f.famille}
              onBlur={(e) => renommerLaFamille(f.famille, e.target.value)}
              className={`min-w-0 flex-1 bg-transparent ${smallCaps}`}
              style={{ color: colors.or, border: "none", padding: 0 }}
            />
            {/* **CE BOUTON S'ÉCRIT, il ne se dessine pas — et c'est une capture
                qui l'a imposé, le 24 août 2026.** Posé en croix, il était le
                jumeau exact de celui des lignes : même signe, même taille, même
                colonne. Rien à l'œil ne disait que l'un retire une prestation
                et l'autre en emporte six d'un coup. Sur un chantier, avec des
                gants, c'est la faute qu'on fait — et le tiroir ne la rattrape
                que six secondes.

                Le compte est DANS le libellé, pour la même raison : « Retirer
                Massifs » laisse croire qu'on retire un titre. */}
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
              className={`-mr-2 flex min-h-[44px] flex-none items-center px-2 ${libelleCaps}`}
              style={{ color: colors.muted }}
            >
              Retirer la famille
            </button>
          </div>

          {f.lignes.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 py-1"
              style={{ borderBottom: `1px solid ${colors.line}` }}
            >
              <input
                defaultValue={p.libelle}
                aria-label={`Prestation ${p.libelle}`}
                data-prestation={p.id}
                onBlur={(e) => renommer(p.id, p.libelle, e.target.value)}
                className="min-h-[48px] flex-1 bg-transparent text-[15px]"
                style={{ color: colors.ink, border: "none", padding: 0 }}
              />
              {/* 44 px de côté : la mesure d'un doigt, pas d'un curseur. */}
              <button
                type="button"
                aria-label={`Retirer ${p.libelle}`}
                onClick={() => retraits.retirer(p.id, `« ${p.libelle} »`)}
                className="flex h-11 w-11 flex-none items-center justify-center text-[18px]"
                style={{ color: colors.muted }}
              >
                ×
              </button>
            </div>
          ))}

          {ajoutOuvert === f.famille ? (
            <div className="mt-3">
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
            <button
              type="button"
              className="mt-3 min-h-[44px] text-[14px]"
              style={{ color: colors.or }}
              onClick={() => {
                setSaisie("");
                setAjoutOuvert(f.famille);
              }}
            >
              + Ajouter une prestation
            </button>
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
        <div className="mt-8">
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
          className="mt-8 min-h-[44px] text-[14px]"
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

      <p className="mt-8 text-[13px] leading-relaxed" style={{ color: colors.muted }}>
        Modifier cette fiche ne change <b style={{ color: colors.ink }}>aucun rapport déjà envoyé</b>
        . Ceux-ci sont partis chez vos clients, et ils restent tels quels.
      </p>

      <TiroirDesRetires
        dernier={retraits.dernier}
        nombre={retraits.nombre}
        onAnnuler={retraits.annuler}
      />
    </div>
  );
}
