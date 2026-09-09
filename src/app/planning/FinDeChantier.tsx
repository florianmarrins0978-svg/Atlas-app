"use client";

import { useEffect, useRef, useState } from "react";
import { colors, font, libelleCaps, surPlein } from "@/lib/design-tokens";
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
 * LA FIN DE CHANTIER — le bandeau déroulant de la fiche d'intervention.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **SON CHOIX DU 8 SEPTEMBRE 2026**, pris sur `appli/fin-de-chantier.html` :
 * *« bien faire comme tu as mis sur la maquette, le bandeau déroulant avec les
 * infos qu'il coche, et écrit, ou ajoute photo ; et une fois qu'il clique sur
 * fini ils se retrouveront dans la catégorie retour d'intervention »*.
 *
 * C'est l'allure **C** de la planche, et ce qu'elle a de mieux que la feuille
 * qui monte : **elle ne recouvre pas la liste des tâches**. Sur la B, il aurait
 * coché de mémoire.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CE QUI NE SE NÉGOCIE PAS ICI.**
 *
 * · **aucun montant** — ce composant n'en reçoit aucun, et la fiche
 *   d'intervention n'en porte pas ;
 * · **ce qui manque se dit AVANT l'appui**, jamais après : un bouton actif qui
 *   refuse au moment du geste se lit comme une panne, et sur un chantier il n'a
 *   personne à qui demander ;
 * · **la règle qui décide est PURE** (`src/lib/retour-intervention.ts`), et la
 *   même que celle du serveur. Deux rédactions du même refus finiraient par se
 *   contredire, et c'est celle de son téléphone qui paraîtrait fausse.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI IL CHARGE SON PROPRE ÉTAT.**
 *
 * `FeuilleChantier` vit au milieu d'un écran de deux mille cinq cents lignes,
 * et faire descendre quatre données de plus depuis la page aurait traversé six
 * composants qui n'en ont que faire. Il demande donc ce qu'il lui faut à
 * l'ouverture, en une seule requête — c'est déjà ce que fait la feuille pour
 * ses tâches.
 */
export default function FinDeChantier({
  chantierId,
  dejaRendu,
  onOuvert,
}: {
  chantierId: string;
  /**
   * Ce chantier a DÉJÀ son retour — lu avec la feuille, pas à l’ouverture.
   *
   * **Sans lui, le verrou n’aurait tenu qu’une session.** Le bandeau ne
   * chargeait son état qu’à l’ouverture : en rouvrant la fiche le lendemain,
   * il aurait retrouvé un bouton vert et pressable sur un chantier déjà
   * rendu — exactement ce qu’il demandait d’empêcher (9 septembre 2026).
   */
  dejaRendu?: boolean;
  /**
   * Le bandeau vient de s’ouvrir ou de se replier.
   *
   * **Sa proposition A, tranchée le 9 septembre 2026** : quand il ouvre, la
   * liste du devis au-dessus s’efface — elle EST devenue les cases. Les deux
   * se lisaient sinon à trois centimètres l’une de l’autre, et il fallait
   * comparer deux fois les mêmes lignes avec des gants.
   *
   * **L’état reste ICI**, où il sert déjà à charger le retour : le remonter
   * en ferait deux, et deux vérités pour une seule question finissent par
   * diverger (`CLAUDE.md` §3). L’écran du dessus n’en est que prévenu.
   */
  onOuvert?: (ouvert: boolean) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [charge, setCharge] = useState(false);
  const [regles, setRegles] = useState<ReglesDuRetour>({ demande: false, photoExigee: false });
  const [taches, setTaches] = useState<TacheDuRetour[]>([]);
  const [photos, setPhotos] = useState<{ id: string; storageKey: string }[]>([]);
  const [reprises, setReprises] = useState<ReadonlySet<string>>(new Set());
  const [aSignaler, setASignaler] = useState("");
  const [dejaPose, setDejaPose] = useState<{ poseLe: string; posePar: string | null } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  // **Chargé à l'OUVERTURE, pas au montage.** La feuille d'un chantier se
  // déplie souvent sans qu'on aille jusqu'à la fin : charger d'office ferait
  // une requête par chantier ouvert, sur un réseau de chantier.
  useEffect(() => {
    if (!ouvert || charge) return;
    let vivant = true;
    etatDuRetourAction(chantierId)
      .then((etat) => {
        if (!vivant) return;
        setRegles(etat.regles);
        setPhotos(etat.photos);
        if (etat.retour) {
          // Il repose un retour déjà posé : on lui rend ce qu'il avait dit,
          // plutôt qu'un écran vierge qui lui ferait tout recocher.
          setTaches(etat.retour.taches.map((t) => ({ libelle: t.libelle, faite: t.faite })));
          setASignaler(etat.retour.aSignaler ?? "");
          setReprises(new Set(etat.retour.photos.map((p) => p.id)));
          setDejaPose({ poseLe: etat.retour.poseLe, posePar: etat.retour.posePar });
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

  const manques = ceQuiManque({ taches, photos: reprises.size }, regles);
  const pret = manques.length === 0 && charge;

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
    setDejaPose({ poseLe: new Date().toISOString(), posePar: null });
    setOuvert(false);
    // La liste du devis revient avec le repli : sans cette ligne, elle restait
    // cachée sur une fiche refermée, et il aurait cru l’avoir perdue.
    onOuvert?.(false);
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

  return (
    <div data-atlas="fin-de-chantier" className="mt-3.5">
      {/* ═══════════════════════════════════════════════════════════════════
          **UNE FOIS POSÉ, LE BOUTON DEVIENT LA PREUVE — sa demande du
          9 septembre 2026 :** *« une fois qu'on clique sur c'est fini la page
          doit se replier toute seule, et à la place de fin de chantier le
          bouton doit dire où c'est parti ; ensuite il passe en grisé, on ne
          peut plus appuyer dessus. »*

          **Il dit OÙ, et c'est tout l'objet.** « C'est parti » seul laisse
          chercher : sur un chantier, savoir que c'est parti ne sert que si
          l'on sait où le retrouver. La seconde ligne est donc l'adresse, pas
          un ornement.

          **Ce que ce verrou coûte, et il l'a tranché en connaissance :** une
          case cochée de travers ne se répare plus depuis le chantier. La
          planche `appli/fiche-sans-doublon.html` porte la variante avec une
          ligne « Corriger », qu'il a écartée — un retour vaut preuve, et une
          preuve ne se réécrit pas (sa décision du 8 septembre).

          Ce n'est pas un bouton grisé qui refuse en silence — le piège que ce
          dépôt s'interdit : il ne ressemble plus à un bouton du tout, et il
          porte ce qu'il a à dire. */}
      {(dejaPose || dejaRendu) && !ouvert ? (
        <div
          data-atlas="retour-pose"
          className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full px-5"
          // **`card` et non `rustTint`, et c’est la capture qui l’a dit.** La
          // carte de la fiche EST déjà en `rustTint` : le bloc s’y fondait
          // exactement, et ne ressemblait plus à un bouton éteint mais à du
          // texte flottant au milieu de l’écran. Aucun contrôle ne pouvait le
          // voir — les deux couleurs sont des jetons justes, c’est leur
          // rencontre qui ne l’était pas (`CLAUDE.md` §5).
          style={{
            backgroundColor: colors.card,
            boxShadow: `inset 0 0 0 1px ${colors.line}`,
            cursor: "default",
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
              style={{ color: colors.inkSoft, fontFamily: font.display }}
            >
              C&apos;est parti
            </span>
            <span className="mt-[1px] block text-[11.5px] leading-[1.3]" style={{ color: colors.muted }}>
              Terminés › Retour d&apos;intervention
            </span>
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            const prochain = !ouvert;
            setOuvert(prochain);
            onOuvert?.(prochain);
          }}
          data-atlas="ouvrir-fin-de-chantier"
          className="mx-auto flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full px-5"
          style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display, fontSize: 16 }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M4 10.4 8.2 14.6 16 5.8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {ouvert ? "Replier" : "Fin de chantier"}
        </button>
      )}
      {ouvert && (
        <div className="mt-3.5">
          {!charge ? (
            <p className="m-0 text-[13.5px]" style={{ color: colors.muted }}>
              Un instant…
            </p>
          ) : (
            <>
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
                    className="flex w-full items-start gap-3 py-[7px] text-left"
                  >
                    {/* Vingt-quatre pixels, et la LIGNE ENTIÈRE est la cible :
                        on vise mal avec des gants, sur un écran sale.

                        **RONDE, et non carrée** — sa règle du 12 août 2026, la
                        même forme partout (`test-boutons-arrondis.ts`). C'est
                        aussi ce que fait déjà la seule autre case du produit,
                        l'interrupteur de l'écran d'envoi : deux dessins pour le
                        même geste finiraient par diverger. */}
                    <span
                      aria-hidden="true"
                      className="grid h-6 w-6 flex-none place-items-center rounded-full"
                      style={{
                        backgroundColor: t.faite ? colors.plein : colors.card,
                        color: t.faite ? surPlein : "transparent",
                        boxShadow: t.faite ? "none" : `inset 0 0 0 1.5px ${colors.line}`,
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

              <div className="mt-2.5 flex flex-wrap items-center gap-[7px]">
                <span className={libelleCaps} style={{ color: colors.muted }}>
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
                        // Le liseré d'or, pas un fond teinté : il tient sur les
                        // huit chartes, dont les deux sombres.
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
                  style={{ backgroundColor: colors.card, color: colors.orTexte, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
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
                className="mt-2.5 w-full resize-none rounded-[9px] px-3.5 py-2.5 text-[14.5px] leading-[1.45] outline-none"
                style={{
                  backgroundColor: colors.card,
                  color: colors.ink,
                  boxShadow: `inset 0 0 0 1px ${colors.line}`,
                }}
              />

              <button
                type="button"
                onClick={() => void envoyer()}
                disabled={!pret || envoi}
                data-atlas="cest-fini"
                className="mx-auto mt-3 block w-max rounded-full px-6 py-3 text-[13.5px] disabled:opacity-45"
                style={{ backgroundColor: colors.plein, color: surPlein }}
              >
                {envoi ? "Un instant…" : "C'est fini"}
              </button>

              {/* Ce qui manque, AVANT l'appui — et le refus du serveur au même
                  endroit : il dit la même chose, écrite par la même fonction. */}
              {(manques.length > 0 || refus) && (
                <p
                  className="mt-2 text-center text-[12.5px] leading-[1.45]"
                  style={{ color: refus ? colors.alert : colors.muted }}
                  data-atlas="ce-qui-manque"
                >
                  {refus ?? manques.join(" et ")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
