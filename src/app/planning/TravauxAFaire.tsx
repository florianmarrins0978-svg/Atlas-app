"use client";

import { useEffect, useRef, useState } from "react";
import { colors, font, libelleCaps, surPlein, voile } from "@/lib/design-tokens";
import { ACCEPT_PHOTOS } from "@/lib/exif";
import {
  ceQuiManque,
  type ReglesDuRetour,
  type TacheDuRetour,
} from "@/lib/retour-intervention";
import {
  ajouterPhotoDuRetourAction,
  etatDuRetourAction,
  poserLeRetourAction,
} from "./retour-actions";

/**
 * « TRAVAUX À FAIRE » — le bandeau qui se déplie sur la fiche d'intervention.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **SA PLANCHE DU 19 SEPTEMBRE 2026**, la sixième de la fiche d'intervention
 * (`appli/fiche-intervention-sixieme.html`), codée sur son *« tu peux coder
 * exactement cette planche »*. Elle remplace le bandeau « Fin de chantier »
 * du 8 septembre — même idée, un bandeau qui se déplie sous la note —, avec
 * quatre décisions nouvelles, toutes de lui :
 *
 * · **le bandeau porte le nom de ce qu'il contient.** *« Fin de chantier, ce
 *   qu'il y a à l'intérieur c'est pas ça, ça veut rien dire. »* Une barre
 *   « Travaux à faire », le compte à droite — « 4 lignes », « 2 sur 4 faits »,
 *   « tout est fait » —, un chevron : la barre EST la poignée, plus de gros
 *   bouton vert pour l'ouvrir ;
 * · **les lignes du devis vivent DEDANS, et nulle part ailleurs.** *« Un
 *   devis de trois pages, ça va faire trop long sur le planning si c'est
 *   visible tout le temps. »* Fermé, le bandeau tient une ligne. Sa
 *   proposition A du 9 septembre (la liste s'efface à l'ouverture parce
 *   qu'elle devient les cases) n'a plus lieu d'être : il n'y a plus qu'une
 *   liste ;
 * · **le retour part TOUJOURS.** *« Il faut qu'on puisse l'envoyer même si on
 *   ne met pas de photo ou si tout n'est pas coché, parce qu'un chantier de
 *   8 jours, il faut pouvoir faire plusieurs retours d'intervention jour après
 *   jour. »* Le bouton s'appelle donc « Envoyer le retour du jour », il est
 *   toujours actif, et ce que le patron attend encore se lit en gris dessous
 *   — un rappel, plus un verrou (`ceQuiManque`) ;
 * · **une fois parti, on dit OÙ le retrouver.** *« À la place de C'est parti,
 *   marque quelque chose pour qu'on comprenne que c'est à retrouver dans la
 *   catégorie Terminés, dans Retour d'intervention. »* — et sans point entre
 *   les deux (sa remarque du même jour).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CE QUI NE SE NÉGOCIE PAS ICI, et qui tient du 8 septembre.**
 *
 * · **aucun montant** — ce composant n'en reçoit aucun ;
 * · **la règle qui dit ce qui manque est PURE** (`src/lib/retour-intervention.ts`) ;
 * · **la case cochée est RONDE** (`test-boutons-arrondis.ts`), remplie du vert
 *   plein — le seul aplat de la fiche, et c'est un fait.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI IL CHARGE SON PROPRE ÉTAT.** `FeuilleChantier` vit au milieu d'un
 * écran de deux mille cinq cents lignes ; il demande donc ce qu'il lui faut à
 * l'ouverture, en une seule requête. Le dernier retour envoyé pré-coche ses
 * cases : le soir 3, il retrouve ce qu'il a coché le soir 2.
 */
export default function TravauxAFaire({
  chantierId,
  lignes,
  retoursEnvoyes,
}: {
  chantierId: string;
  /**
   * Les lignes du devis, telles que la fiche les a déjà lues — pour le compte
   * du bandeau fermé (« 4 lignes ») sans une requête de plus.
   */
  lignes: readonly string[];
  /** Combien de retours ce chantier a déjà envoyés, lu avec la feuille. */
  retoursEnvoyes: number;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [charge, setCharge] = useState(false);
  const [regles, setRegles] = useState<ReglesDuRetour>({ demande: false, photoExigee: false });
  const [taches, setTaches] = useState<TacheDuRetour[]>(
    lignes.map((libelle) => ({ libelle, faite: false }))
  );
  const [photos, setPhotos] = useState<{ id: string; storageKey: string }[]>([]);
  const [reprises, setReprises] = useState<ReadonlySet<string>>(new Set());
  const [aSignaler, setASignaler] = useState("");
  const [envoyes, setEnvoyes] = useState(retoursEnvoyes);
  // « Retour du jour envoyé » n'est vrai que le temps de la session, et pour le
  // premier ; ensuite c'est le compte qui parle — « 2 retours envoyés », comme
  // sur sa planche —, et en rouvrant la fiche demain, « 1 retour envoyé ».
  const [vientDePartir, setVientDePartir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  // **Chargé à l'OUVERTURE, pas au montage.** La fiche d'un chantier se déplie
  // souvent sans qu'on aille jusqu'aux travaux : charger d'office ferait une
  // requête par chantier ouvert, sur un réseau de chantier.
  useEffect(() => {
    if (!ouvert || charge) return;
    let vivant = true;
    etatDuRetourAction(chantierId)
      .then((etat) => {
        if (!vivant) return;
        setRegles(etat.regles);
        setPhotos(etat.photos);
        setEnvoyes(etat.envoyes);
        if (etat.retour) {
          // Le soir 3 repart du soir 2 : ses cases, pas un écran vierge qui
          // lui ferait tout recocher. Les photos et le mot, eux, sont ceux
          // du jour — un retour est une preuve datée.
          setTaches(etat.retour.taches.map((t) => ({ libelle: t.libelle, faite: t.faite })));
        } else {
          setTaches(etat.aFaire.map((libelle) => ({ libelle, faite: false })));
        }
        setCharge(true);
      })
      .catch(() => {
        if (vivant) setRefus("Impossible de lire ce chantier pour l'instant.");
      });
    return () => {
      vivant = false;
    };
  }, [ouvert, charge, chantierId]);

  const faites = taches.filter((t) => t.faite).length;
  const manques = ceQuiManque({ taches, photos: reprises.size }, regles);

  async function envoyer() {
    setEnvoi(true);
    setRefus(null);
    const r = await poserLeRetourAction(chantierId, {
      taches,
      photoIds: [...reprises],
      aSignaler: aSignaler.trim() || null,
    });
    setEnvoi(false);
    // **Le refus s'affiche.** Le 11 août 2026, « Impossible d'enregistrer la
    // note » ne pouvait être expliqué par personne, faute d'avoir laissé le
    // refus arriver jusqu'à l'écran.
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    setEnvoyes((n) => n + 1);
    setVientDePartir(true);
    // Les photos et le mot repartent vides pour demain ; les cases restent.
    setReprises(new Set());
    setASignaler("");
    setOuvert(false);
  }

  async function ajouterUnePhoto(fichier: File) {
    setRefus(null);
    const corps = new FormData();
    corps.set("chantierId", chantierId);
    corps.set("fichier", fichier);
    const r = await ajouterPhotoDuRetourAction(corps);
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    setPhotos((avant) => [...avant, { id: r.id, storageKey: r.storageKey }]);
    // Une photo qu'il vient de prendre est une photo qu'il veut montrer :
    // la lui faire cocher ensuite serait un geste de plus, avec des gants.
    setReprises((avant) => new Set([...avant, r.id]));
  }

  const compte =
    taches.length === 0
      ? "aucune ligne"
      : faites === 0
        ? `${taches.length} ligne${taches.length > 1 ? "s" : ""}`
        : faites === taches.length
          ? "tout est fait"
          : `${faites} sur ${taches.length} fait${faites > 1 ? "s" : ""}`;

  return (
    <div data-atlas="travaux-a-faire" className="mt-3.5">
      {/* La barre : une seule forme pour le nom, le compte et le chevron. Le
          rayon est sur le CONTENANT, et le bouton emplit toute la barre — la
          poignée est la barre entière, pas un mot dedans. */}
      <div
        className="overflow-hidden rounded-[12px]"
        style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
      >
        <button
          type="button"
          data-atlas="ouvrir-travaux"
          aria-expanded={ouvert}
          onClick={() => setOuvert((o) => !o)}
          className="flex min-h-[54px] w-full items-center gap-2.5 pl-4 pr-3.5 text-left"
          style={{ background: voile(colors.plein, 0.16) }}
        >
          <span
            className="min-w-0 flex-1 text-[16px] leading-[1.2]"
            style={{ fontFamily: font.display, color: colors.rust }}
          >
            Travaux à faire
          </span>
          <span
            data-atlas="compte-des-travaux"
            className="flex-none text-[12.5px] font-semibold"
            style={{ color: colors.rust }}
          >
            {compte}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className="flex-none transition-transform duration-300"
            style={{ color: colors.rust, transform: ouvert ? "rotate(180deg)" : "none" }}
          >
            <path
              d="M5 8l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Le pli : une grille 0fr → 1fr, rien à mesurer, et le contenu
            glisse en s'ouvrant. */}
        <div
          className="grid transition-[grid-template-rows] duration-300"
          style={{ gridTemplateRows: ouvert ? "1fr" : "0fr" }}
        >
          <div className="min-h-0 overflow-hidden px-3.5">
            {ouvert && !charge ? (
              <p className="m-0 py-3 text-[13.5px]" style={{ color: colors.muted }}>
                {refus ?? "Un instant…"}
              </p>
            ) : charge ? (
              <div className="pb-3.5 pt-2.5">
                {taches.length === 0 ? (
                  <p className="m-0 text-[13.5px] leading-[1.5]" style={{ color: colors.muted }}>
                    Aucune ligne sur le devis. Vous pouvez quand même poser une photo et un mot.
                  </p>
                ) : (
                  taches.map((t, rang) => (
                    <button
                      key={`${t.libelle}-${rang}`}
                      type="button"
                      aria-pressed={t.faite}
                      data-atlas="tache-du-retour"
                      onClick={() =>
                        setTaches((avant) =>
                          avant.map((x, i) => (i === rang ? { ...x, faite: !x.faite } : x))
                        )
                      }
                      className="flex min-h-[44px] w-full items-start gap-3 py-1.5 text-left"
                    >
                      {/* Vingt-quatre pixels, et la LIGNE ENTIÈRE est la cible :
                          on vise mal avec des gants, sur un écran sale.
                          RONDE — sa règle du 12 août 2026, la même forme
                          partout (`test-boutons-arrondis.ts`). */}
                      <span
                        aria-hidden="true"
                        className="grid h-6 w-6 flex-none place-items-center rounded-full"
                        style={{
                          backgroundColor: t.faite ? colors.plein : colors.card,
                          color: t.faite ? surPlein : "transparent",
                          boxShadow: t.faite ? "none" : `inset 0 0 0 1.5px ${colors.vertPale}`,
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <path
                            d="M3 8.4 6.3 11.7 13 5"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span
                        className="min-w-0 flex-1 pt-0.5 text-[14.5px] leading-[1.45]"
                        style={{ color: t.faite ? colors.muted : colors.ink }}
                      >
                        {t.libelle}
                      </span>
                    </button>
                  ))
                )}

                <div className="mt-2 flex flex-wrap items-center gap-[7px]">
                  <span className={libelleCaps} style={{ color: colors.ink }}>
                    Photos
                  </span>
                  {photos.map((p) => {
                    const prise = reprises.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={prise}
                        data-atlas="photo-du-retour"
                        onClick={() =>
                          setReprises((avant) => {
                            const apres = new Set(avant);
                            if (apres.has(p.id)) apres.delete(p.id);
                            else apres.add(p.id);
                            return apres;
                          })
                        }
                        className="h-[46px] w-[46px] overflow-hidden rounded-[9px]"
                        style={{
                          opacity: prise ? 1 : 0.45,
                          backgroundColor: colors.rustTint,
                          boxShadow: prise
                            ? `inset 0 0 0 2px ${colors.or}`
                            : `inset 0 0 0 1px ${colors.line}`,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/fichiers/${p.storageKey}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => champ.current?.click()}
                    aria-label="Ajouter une photo"
                    data-atlas="ajouter-photo-retour"
                    className="grid h-[46px] w-[46px] place-items-center rounded-[9px]"
                    style={{
                      backgroundColor: voile(colors.plein, 0.16),
                      color: colors.rust,
                      boxShadow: `inset 0 0 0 1px ${colors.vertPale}`,
                    }}
                  >
                    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                    </svg>
                  </button>
                  {/* **Sans `capture`** : sur un iPhone il IMPOSE l'appareil photo
                      et retire l'accès à la pellicule — celui qui a photographié
                      le matin ne pourrait plus rien joindre l'après-midi. */}
                  <input
                    ref={champ}
                    type="file"
                    accept={ACCEPT_PHOTOS}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void ajouterUnePhoto(f);
                      e.target.value = "";
                    }}
                  />
                </div>

                <textarea
                  value={aSignaler}
                  onChange={(e) => setASignaler(e.target.value)}
                  placeholder="À signaler — facultatif"
                  data-atlas="a-signaler"
                  rows={2}
                  // **16 px au moins.** En dessous, iOS grossit la page à la mise
                  // au point et l'écran saute sous le doigt.
                  className="mt-2.5 w-full resize-none rounded-[10px] px-3 py-2.5 text-[16px] leading-[1.45] outline-none"
                  style={{
                    backgroundColor: voile(colors.or, 0.13),
                    color: colors.ink,
                    boxShadow: `inset 0 0 0 1px ${voile(colors.or, 0.22)}`,
                    caretColor: colors.or,
                  }}
                />

                {/* Toujours actif : il part avec ce qu'il a. Il ne se ferme
                    que le temps de l'envoi — c'est ce qui tient le double appui
                    d'un réseau lent, depuis que l'index unique ne le tient plus
                    (migration 0096). */}
                <button
                  type="button"
                  onClick={() => void envoyer()}
                  disabled={envoi}
                  data-atlas="envoyer-le-retour"
                  className="mx-auto mt-3.5 block w-max rounded-full px-6 py-3 text-[15px] disabled:opacity-45"
                  style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
                >
                  {envoi ? "Un instant…" : "Envoyer le retour du jour"}
                </button>

                {/* Ce que le patron attend encore, AVANT l'appui — un rappel,
                    plus un verrou. Et le refus du serveur au même endroit. */}
                {(manques.length > 0 || refus) && (
                  <p
                    className="mb-0 mt-2 text-center text-[12.5px] leading-[1.45]"
                    style={{ color: refus ? colors.alert : colors.muted }}
                    data-atlas="ce-qui-manque"
                  >
                    {refus ?? manques.join(" et ")}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Une fois parti, on dit OÙ le retrouver — et le bandeau reste ouvert
          au lendemain : un chantier de huit jours envoie huit retours. */}
      {envoyes > 0 && (
        <div
          data-atlas="retour-envoye"
          className="mt-2.5 flex items-center gap-3 rounded-[12px] px-4 py-2.5"
          style={{
            backgroundColor: voile(colors.plein, 0.16),
            boxShadow: `inset 0 0 0 1px ${colors.vertPale}`,
          }}
        >
          <span
            aria-hidden="true"
            className="grid h-[19px] w-[19px] flex-none place-items-center rounded-full"
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6.3 4.7 9 10 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="min-w-0">
            <span
              className="block text-[15px] leading-[1.15]"
              style={{ color: colors.rust, fontFamily: font.display }}
            >
              {vientDePartir && envoyes === 1
                ? "Retour du jour envoyé"
                : `${envoyes} retour${envoyes > 1 ? "s" : ""} envoyé${envoyes > 1 ? "s" : ""}`}
            </span>
            <span className="mt-[1px] block text-[11.5px] leading-[1.3]" style={{ color: colors.muted }}>
              À retrouver dans Terminés, Retour d&apos;intervention
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
