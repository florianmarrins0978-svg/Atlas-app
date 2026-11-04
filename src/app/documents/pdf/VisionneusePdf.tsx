"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { colors, spacing, surPlein, voile } from "@/lib/design-tokens";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import IconeTrait from "@/components/atlas/IconeTrait";
import { basculerSautDePageAction, retirerLesSautsDePageAction } from "./actions";

/**
 * Peint un PDF page par page, dans l'application.
 *
 * **Pourquoi pas un `<iframe>`.** Sur iOS, un PDF dans un cadre ne montre que
 * sa première page et ne défile pas — un devis de trois pages y serait
 * illisible. pdf.js dessine chaque page sur une toile, et c'est l'écran qui
 * défile, comme n'importe quel autre.
 *
 * **Le fil de travail vient de `pdfjs-dist/webpack.mjs`**, et non d'une copie
 * dans `public/` : pdf.js refuse un fil dont la version n'est pas la sienne,
 * et une copie faite à la main ne suit pas les mises à jour du paquet.
 *
 * ─── LA VERSION EST ÉPINGLÉE, ET CE N'EST PAS DE LA PRUDENCE DE PRINCIPE ───
 *
 * **`pdfjs-dist` est figé à 5.4.624 dans `package.json`, sans accent
 * circonflexe.** À partir de la 5.5, pdf.js appelle
 * `Map.prototype.getOrInsertComputed` — une méthode arrivée dans les
 * navigateurs en 2025. Là où elle manque, l'écran ne rend pas une page moins
 * jolie : il rend **« Le document ne s'ouvre pas »**, et le devis reste
 * invisible.
 *
 * Mesuré le 13 septembre 2026 : avec la 6.3, la visionneuse refusait déjà sur
 * le Chromium de l'atelier (141). Et ce n'est pas l'atelier qui décide — **la
 * page publique du devis est ouverte par SES CLIENTS**, sur le téléphone
 * qu'ils ont. Faire dépendre la lecture d'un devis d'une méthode d'un an,
 * c'est perdre le client qui n'a pas mis son téléphone à jour.
 *
 * Remonter cette version se fait donc en le vérifiant, jamais par habitude :
 * `grep -c getOrInsertComputed node_modules/pdfjs-dist/build/pdf.mjs` doit
 * rendre 0, et `test-visionneuse-pdf.ts` le tient désormais.
 *
 * **Chargé à l'appui, jamais au départ.** La bibliothèque pèse plus que tout
 * le reste de l'écran ; elle n'est demandée que quand cet écran s'ouvre.
 *
 * ─── LA MISE EN PAGE D'UN DEVIS — sa planche du 3 novembre 2026 ───────────
 *
 * Sur l'aperçu d'un devis brouillon (`miseEnPage`), il touche une ligne, puis
 * « Nouvelle page ici ». **La place de chaque ligne vient de la trace du PDF
 * qu'on peint** (`/api/devis/<id>/mise-en-page`), jamais d'un calcul refait
 * ici : une règle de mise en page tenue à deux endroits ferait couper la ligne
 * d'à côté. Les zones à toucher se posent PAR-DESSUS la toile, à la hauteur
 * que le PDF donne, en pourcentage de sa page.
 */

type ElementMisEnPage = { cle: string; page: number; haut: number; bas: number };
type MiseEnPageLue = { modifiable: boolean; sauts: string[]; hauteurPage: number; elements: ElementMisEnPage[] };
type Feuille = { avant: HTMLDivElement; feuille: HTMLDivElement };

/**
 * La phrase ne revient plus une fois comprise : au premier saut, ou sur
 * « Compris ». Retenue par CE téléphone seulement : c'est une aide, pas une
 * donnée, et la perdre en changeant d'appareil ne coûte qu'une phrase revue.
 */
const ASTUCE_COMPRISE = "atlas:astuce-saut-de-page";

function astuceDejaComprise(): boolean {
  try {
    return window.localStorage.getItem(ASTUCE_COMPRISE) === "1";
  } catch {
    // Stockage refusé : la phrase se montre, ce qui ne gêne rien.
    return false;
  }
}

function retenirAstuce(): boolean {
  try {
    window.localStorage.setItem(ASTUCE_COMPRISE, "1");
    return true;
  } catch {
    return false;
  }
}

export default function VisionneusePdf({
  fichier,
  miseEnPage,
}: {
  fichier: string;
  /** L'aperçu d'un devis à mettre en page : son identifiant, et où lire sa mise en page. */
  miseEnPage?: { devisId: string; adresse: string } | null;
}) {
  const pages = useRef<HTMLDivElement>(null);
  const [etat, setEtat] = useState<"en cours" | "peint" | { refus: string }>("en cours");
  // Un saut posé change le PDF : le compteur le fait repeindre.
  const [peinture, setPeinture] = useState(0);
  const [feuilles, setFeuilles] = useState<Feuille[]>([]);
  const [mise, setMise] = useState<MiseEnPageLue | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [refusSaut, setRefusSaut] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  // Lue une fois, à la naissance de l'écran : la phrase ne se montre qu'une
  // fois la mise en page lue, donc jamais au premier rendu du serveur.
  const [astuce, setAstuce] = useState(() => typeof window !== "undefined" && !astuceDejaComprise());
  const adresseMiseEnPage = miseEnPage?.adresse ?? null;

  useEffect(() => {
    const conteneur = pages.current;
    if (!conteneur) return;
    let abandonne = false;
    // La roue la première fois (l'état de départ) ; ensuite, la page d'avant
    // reste sous les yeux jusqu'à ce que la nouvelle soit prête : vidée
    // d'abord, elle ferait remonter l'écran tout en haut à chaque saut posé.

    (async () => {
      const reponse = await fetch(fichier, { credentials: "same-origin", cache: "no-store" });
      if (!reponse.ok) {
        // Le refus se DIT avec son code : « introuvable » et « session
        // expirée » ne se réparent pas au même endroit.
        setEtat({ refus: `Le document ne s'ouvre pas (réponse ${reponse.status}).` });
        return;
      }
      const octets = await reponse.arrayBuffer();
      const pdfjs = await import("pdfjs-dist/webpack.mjs");
      const document_ = await pdfjs.getDocument({ data: octets }).promise;
      if (abandonne) return;

      // La toile a la définition de l'écran (Retina : 2 ou 3 points par
      // pixel) ; sans quoi le texte d'une facture se lit flou. Sa largeur
      // affichée suit celle de l'écran en CSS, donc une rotation du téléphone
      // ne laisse pas une page étroite au milieu.
      const definition = window.devicePixelRatio || 1;
      const largeur = conteneur.clientWidth;
      const morceaux = document.createDocumentFragment();
      const peintes: Feuille[] = [];
      for (let numero = 1; numero <= document_.numPages; numero++) {
        const page = await document_.getPage(numero);
        if (abandonne) return;
        const naturelle = page.getViewport({ scale: 1 });
        const vue = page.getViewport({ scale: (largeur / naturelle.width) * definition });
        const toile = document.createElement("canvas");
        toile.width = Math.ceil(vue.width);
        toile.height = Math.ceil(vue.height);
        toile.style.width = "100%";
        toile.style.height = "auto";
        toile.style.display = "block";
        toile.setAttribute("data-atlas", "page-pdf");
        toile.setAttribute("aria-label", `Page ${numero} sur ${document_.numPages}`);
        await page.render({ canvas: toile, viewport: vue }).promise;
        if (abandonne) return;
        // Entre deux pages, la place d'un saut posé ; sur la page, celle des
        // lignes à toucher. Les deux reçoivent ce que React y dessine.
        const avant = document.createElement("div");
        const feuille = document.createElement("div");
        feuille.style.position = "relative";
        feuille.appendChild(toile);
        morceaux.append(avant, feuille);
        peintes.push({ avant, feuille });
      }
      // La mise en page se lit APRÈS la peinture, sur le même devis : une
      // ligne posée entre-temps décalerait les zones d'une ligne.
      let lue: MiseEnPageLue | null = null;
      if (adresseMiseEnPage) {
        const r = await fetch(adresseMiseEnPage, { credentials: "same-origin", cache: "no-store" });
        lue = r.ok ? ((await r.json()) as MiseEnPageLue) : null;
      }
      if (abandonne) return;
      conteneur.replaceChildren(morceaux);
      setFeuilles(peintes);
      setMise(lue);
      setEtat("peint");
    })().catch((e: unknown) => {
      if (abandonne) return;
      setEtat({ refus: `Le document ne s'ouvre pas (${e instanceof Error ? e.message : String(e)}).` });
    });

    return () => {
      abandonne = true;
    };
  }, [fichier, adresseMiseEnPage, peinture]);

  const comprendre = () => {
    setAstuce(false);
    retenirAstuce();
  };

  const repeindre = () => {
    setChoisi(null);
    setPeinture((n) => n + 1);
  };

  const basculer = async (cle: string) => {
    if (!miseEnPage) return;
    setEnCours(true);
    setRefusSaut(null);
    const issue = await basculerSautDePageAction(miseEnPage.devisId, cle);
    setEnCours(false);
    if (!issue.ok) {
      setRefusSaut(issue.raison);
      return;
    }
    comprendre();
    repeindre();
  };

  const toutRemettre = async () => {
    if (!miseEnPage) return;
    setEnCours(true);
    setRefusSaut(null);
    const issue = await retirerLesSautsDePageAction(miseEnPage.devisId);
    setEnCours(false);
    if (!issue.ok) {
      setRefusSaut(issue.raison);
      return;
    }
    repeindre();
  };

  const modifiable = !!mise?.modifiable;
  const premierDeLaPage = (numero: number) => mise?.elements.find((e) => e.page === numero) ?? null;
  // « Déjà en haut d'une page » : la première ligne d'une page qui n'est pas
  // la première. Sur la page 1, couper avant la première ligne envoie encore
  // le tableau à la page 2, et c'est son droit.
  const choisiEnHaut =
    !!choisi && !!mise && mise.elements.some((e) => e.cle === choisi && e.page > 1 && premierDeLaPage(e.page)?.cle === choisi);
  const choisiSaute = !!choisi && !!mise?.sauts.includes(choisi);
  const pourcent = (points: number) => `${((points / (mise?.hauteurPage ?? 841.89)) * 100).toFixed(3)}%`;

  return (
    <div className={`${spacing.pageX} mt-5`}>
      {modifiable && astuce && (
        <div
          data-atlas="astuce-saut-de-page"
          className="mb-3 flex items-center gap-2.5 rounded-2xl py-2.5 pl-3.5 pr-2"
          style={{ background: voile(colors.or, 0.13) }}
        >
          <span style={{ color: colors.orTexte }}>
            <IconeTrait nom="info" />
          </span>
          <p className="flex-1 text-[14.5px] leading-snug" style={{ color: colors.ink }}>
            Touchez une ligne pour commencer une nouvelle page à cet endroit.
          </p>
          <button
            type="button"
            onClick={comprendre}
            className="min-h-10 rounded-full px-3 text-[14.5px] font-semibold"
            style={{ color: colors.orTexte }}
          >
            Compris
          </button>
        </div>
      )}
      {modifiable && mise.sauts.length > 0 && (
        <div className="mb-2 flex justify-center">
          <button
            type="button"
            data-atlas="tout-remettre"
            onClick={() => void toutRemettre()}
            disabled={enCours}
            className="min-h-10 rounded-full px-4 text-[14.5px] font-semibold disabled:opacity-50"
            style={{ color: colors.rust }}
          >
            Tout remettre
          </button>
        </div>
      )}
      {refusSaut && (
        <p role="alert" className="mb-2 text-center text-[14px]" style={{ color: colors.alert }}>
          {refusSaut}
        </p>
      )}
      {etat === "en cours" && (
        <p className="py-6 text-center text-[14px]" style={{ color: colors.muted }}>
          <PointsQuiSoufflent />
        </p>
      )}
      {typeof etat === "object" && (
        <p role="alert" data-atlas="refus-pdf" className="py-6 text-center text-[14px]" style={{ color: colors.alert }}>
          {etat.refus}
        </p>
      )}
      {/* Les pages, l'une sous l'autre, chacune avec l'ombre d'une feuille :
          le fond blanc de la toile ne suit aucune charte, c'est du papier. */}
      <div ref={pages} className="flex flex-col gap-3" style={{ filter: `drop-shadow(0 1px 3px ${colors.line})` }} />

      {modifiable &&
        feuilles.map((f, i) => {
          const numero = i + 1;
          const premier = premierDeLaPage(numero);
          const sautIci = numero > 1 && !!premier && mise.sauts.includes(premier.cle);
          return (
            <Fragment key={numero}>
              {sautIci &&
                createPortal(
                  <div className="flex justify-center">
                    <span
                      data-atlas="saut-de-page"
                      className="inline-flex min-h-9 items-center gap-1 rounded-full py-0.5 pl-3.5 pr-1 text-[14px] font-semibold"
                      style={{ background: colors.plein, color: surPlein }}
                    >
                      Saut de page
                      <button
                        type="button"
                        aria-label="Retirer le saut de page"
                        onClick={() => void basculer(premier.cle)}
                        disabled={enCours}
                        className="grid h-8 w-8 place-items-center rounded-full"
                      >
                        <IconeTrait nom="croix" taille={16} />
                      </button>
                    </span>
                  </div>,
                  f.avant
                )}
              {createPortal(
                mise.elements
                  .filter((e) => e.page === numero)
                  .map((e) => (
                    <button
                      key={e.cle}
                      type="button"
                      data-atlas="ligne-a-couper"
                      data-cle={e.cle}
                      aria-pressed={choisi === e.cle}
                      aria-label="Choisir cet endroit"
                      onClick={() => setChoisi((c) => (c === e.cle ? null : e.cle))}
                      className="absolute inset-x-0 block"
                      style={{
                        top: pourcent(mise.hauteurPage - e.haut),
                        height: pourcent(e.haut - e.bas),
                        background: choisi === e.cle ? voile(colors.or, 0.22) : "transparent",
                        boxShadow: choisi === e.cle ? `inset 0 0 0 2px ${colors.or}` : "none",
                      }}
                    />
                  )),
                f.feuille
              )}
            </Fragment>
          );
        })}

      {modifiable && choisi && (
        <div className="atlas-colonne-fixe z-[19] px-4" style={{ bottom: "calc(var(--atlas-barre) + 12px)" }}>
          <div
            data-atlas="action-saut-de-page"
            className="flex items-center gap-2 rounded-full p-2"
            style={{ background: colors.card, boxShadow: `0 6px 24px ${voile(colors.ink, 0.22)}, 0 0 0 1px ${colors.line}` }}
          >
            {choisiEnHaut && !choisiSaute ? (
              <p className="flex-1 px-3 text-[14.5px]" style={{ color: colors.inkSoft }}>
                Déjà en haut d&apos;une page.
              </p>
            ) : (
              <button
                type="button"
                data-atlas="nouvelle-page-ici"
                onClick={() => void basculer(choisi)}
                disabled={enCours}
                className="atlas-plein min-h-12 flex-1 rounded-full text-[17px] font-semibold disabled:opacity-60"
                style={{ backgroundColor: colors.plein, color: surPlein }}
              >
                {choisiSaute ? "Retirer le saut de page" : "Nouvelle page ici"}
              </button>
            )}
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setChoisi(null)}
              className="grid h-11 w-11 flex-none place-items-center rounded-full"
              style={{ color: colors.ink }}
            >
              <IconeTrait nom="croix" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
