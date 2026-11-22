"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { colors } from "@/lib/design-tokens";
import { CATALOGUE } from "@/lib/arrosage/catalogue.js";

/**
 * LA NOURRICE EN 3D, À L'ÉCRAN DU PLAN — sa demande du 22 novembre 2026 :
 * *« j'aimerais que tu me mettes exactement cette planche dans l'application
 * [...] quand je clique, on a les pièces qui s'éclatent, je reclique, ça se
 * remet en place. Pouvoir le déplacer, zoomer. »*
 *
 * La 3D n'est pas recopiée ici : c'est le module de la planche
 * (`appli/nourrice-3d/vue.js`), le même que montre la page des outils du site.
 * Trois copies d'une pièce relevée au dixième de millimètre auraient divergé à
 * la première retouche (`CLAUDE.md` §3). Il vit dans `appli/` parce que GitHub
 * Pages ne publie que ce dossier ; ses modules de three importent `three`, qui
 * se résout ici dans `node_modules` à la même version (0.160.0, épinglée).
 *
 * Ce qui change par rapport à la planche : le nombre de voies et le
 * goutte-à-goutte viennent du plan, ils ne se choisissent pas ici.
 *
 * **Les repères** (sa planche `appli/arrosage-nourrice-3d-numeros.html`, son
 * choix du 22 novembre 2026 : *« la A noire, à l'éclaté seulement »*) : le
 * numéro de la légende sur chaque pièce, la flèche de l'arrivée d'eau, et R1,
 * R2… au bout des colonnes. Ils viennent du même module que la planche
 * (`appli/nourrice-3d/reperes.js`), pour la même raison que la 3D.
 *
 * **« Voir »** (sa réponse du même soir : *« rajouter voir à changer
 * supprimer »*) : la feuille d'une pièce de la légende le propose ; la
 * nourrice s'éclate, les pièces de ce modèle gardent leur couleur, les autres
 * se voilent, et leurs numéros s'allument. Remonter la nourrice rend tout.
 *
 * **Quand l'appareil ne sait pas afficher la 3D** (WebGL 2 absent, chargement
 * raté), l'écran montre le dessin d'avant (`repli`) : l'artisan garde sa
 * nourrice, plutôt qu'une phrase à la place.
 */
type Vue = "biais" | "dessus" | "face" | "";
type NourriceOuverte = {
  montrer(voies: number, goutte: number): unknown;
  eclater(oui: boolean): void;
  regarder(vue: Vue): void;
  choisir(cle: string | null): void;
  detruire(): void;
  surEtat(f: (e: { eclatee: boolean; vue: Vue }) => void): void;
  scene: { surImage(f: () => void): void };
};
type Reperes = { placer(): void; choisir(cle: string | null): void; detruire(): void };
/** Le nom et la couleur d'une voie, dans l'ordre de la composition : R1, R2… */
export type Reseau3D = { nom: string; couleur: string };

const CAT = CATALOGUE as unknown as { ficheNourrice(n: number, goutte: number): unknown };

const VUES: { cle: Exclude<Vue, "">; nom: string }[] = [
  { cle: "biais", nom: "De biais" },
  { cle: "dessus", nom: "Dessus" },
  { cle: "face", nom: "De face" },
];

export default function Nourrice3D({
  voies,
  nbGoutte,
  repli,
  reseaux,
  montree,
  onRendre,
  onPrete,
}: {
  voies: number;
  nbGoutte: number;
  repli: ReactNode;
  reseaux: Reseau3D[];
  /** La pièce qu'il a demandé à voir (« Voir », dans sa feuille) ; un nouvel objet à chaque demande. */
  montree: { ref: string } | null;
  /** La nourrice s'est remontée : la pièce montrée ne l'est plus. */
  onRendre: () => void;
  /** La 3D s'affiche, ou le dessin la remplace : « Voir » ne se propose qu'avec elle. */
  onPrete: (oui: boolean) => void;
}) {
  const toile = useRef<HTMLCanvasElement>(null);
  const cadre = useRef<HTMLDivElement>(null);
  const couche = useRef<HTMLDivElement>(null);
  const ouverte = useRef<NourriceOuverte | null>(null);
  const reperes = useRef<Reperes | null>(null);
  // Lus à chaque image par les repères, et au remontage : toujours les derniers reçus.
  const derniers = useRef({ reseaux, onRendre });
  const [etat, setEtat] = useState<"chargement" | "prete" | "repli">("chargement");
  const [eclatee, setEclatee] = useState(false);
  const [vue, setVue] = useState<Vue>("biais");
  // Les dernières voies demandées : si elles changent pendant le chargement, c'est elles que la scène pose.
  const demandees = useRef({ voies, nbGoutte });

  useEffect(() => {
    const canvas = toile.current, calque = couche.current;
    if (!canvas || !calque) return;
    let fini = false;
    Promise.all([import("../../../../appli/nourrice-3d/vue.js"), import("../../../../appli/nourrice-3d/reperes.js")])
      .then(([m, r]) => {
        if (fini) return;
        const v = m.ouvrirNourrice(canvas, {
          ficheNourrice: CAT.ficheNourrice,
          hdri: new URL("../../../../appli/vendor/hdri/studio.exr", import.meta.url).href,
        }) as NourriceOuverte;
        ouverte.current = v;
        // Une voie que la composition compterait en trop n'a pas de nom à lire : elle le dit plutôt que de s'en inventer un.
        const rep = r.poserReperes(calque, v, { voie: (k: number) => derniers.current.reseaux[k] ?? { nom: "?", couleur: colors.alert } }) as Reperes;
        reperes.current = rep;
        v.scene.surImage(rep.placer);
        v.surEtat((e) => {
          setEclatee(e.eclatee);
          setVue(e.vue);
          if (!e.eclatee) derniers.current.onRendre();
        });
        v.montrer(demandees.current.voies, demandees.current.nbGoutte);
        let vue = false;
        v.scene.surImage(() => {
          if (vue) return;
          vue = true;
          setEtat("prete");
        });
      })
      .catch((erreur: unknown) => {
        // Une panne imprévue se journalise avant de se replier : sans quoi le
        // repli serait muet, et personne ne saurait pourquoi la 3D manque.
        console.error("La nourrice en 3D ne s'affiche pas, le dessin la remplace :", erreur);
        if (!fini) setEtat("repli");
      });
    return () => {
      fini = true;
      reperes.current?.detruire();
      reperes.current = null;
      ouverte.current?.detruire();
      ouverte.current = null;
    };
  }, []);

  // « Voir » : la nourrice s'éclate, la pièce garde sa couleur, et la vue revient sous les yeux (la
  // feuille qui vient de se fermer couvrait la 3D, et la légende est dessous).
  useEffect(() => {
    const v = ouverte.current;
    if (!v) return;
    const cle = montree?.ref ?? null;
    v.choisir(cle);
    reperes.current?.choisir(cle);
    if (!montree) return;
    v.eclater(true);
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cadre.current?.scrollIntoView({ block: "nearest", behavior: reduit ? "auto" : "smooth" });
  }, [montree]);

  // Un réseau renommé ou recoloré par le plan : les mots du bas suivent sans attendre la prochaine image.
  useEffect(() => {
    derniers.current = { reseaux, onRendre };
    reperes.current?.placer();
  }, [reseaux, onRendre]);

  useEffect(() => {
    if (etat !== "chargement") onPrete(etat === "prete");
  }, [etat, onPrete]);

  useEffect(() => {
    demandees.current = { voies, nbGoutte };
    const v = ouverte.current;
    if (!v) return;
    // Par une promesse, comme l'ouverture : un refus de recomposer prend le même chemin vers le repli.
    Promise.resolve()
      .then(() => v.montrer(voies, nbGoutte))
      .catch((erreur: unknown) => {
        console.error("La nourrice en 3D ne se recompose pas, le dessin la remplace :", erreur);
        setEtat("repli");
      });
  }, [voies, nbGoutte]);

  if (etat === "repli") return <>{repli}</>;

  const bouton = (presse: boolean) => ({
    backgroundColor: presse ? colors.ink : colors.card,
    color: presse ? colors.card : colors.ink,
    boxShadow: `inset 0 0 0 1px ${presse ? colors.ink : colors.line}`,
  });

  return (
    <div data-atlas="nourrice-3d" data-pret={etat === "prete"}>
      {/* scroll-mt : « Voir » ramène la vue sous la barre des parties qui colle en haut, comme la section. */}
      <div ref={cadre} className="relative w-full scroll-mt-[72px] overflow-hidden rounded-[6px]" style={{ aspectRatio: "4 / 5", maxHeight: "76vh", backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
        <canvas
          ref={toile}
          tabIndex={0}
          role="img"
          aria-label="La nourrice en 3D. Un toucher l’éclate, un second la remonte."
          className="block h-full w-full outline-none"
          style={{ touchAction: "none", cursor: "grab", WebkitTapHighlightColor: "transparent" }}
        />
        <div ref={couche} aria-hidden="true" data-atlas="nourrice-reperes" />
        <div
          role="status"
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[14px] transition-opacity duration-300"
          style={{ backgroundColor: colors.card, color: colors.inkSoft, opacity: etat === "prete" ? 0 : 1 }}
        >
          Chargement
        </div>
      </div>

      <div className="mt-3 flex gap-1.5" role="group" aria-label="Montage">
        {[false, true].map((oui) => (
          <button
            key={String(oui)}
            type="button"
            aria-pressed={eclatee === oui}
            data-atlas={oui ? "nourrice-eclater" : "nourrice-monter"}
            onClick={() => ouverte.current?.eclater(oui)}
            className="min-h-[44px] min-w-0 flex-1 rounded-full border-0 text-[15px]"
            style={bouton(eclatee === oui)}
          >
            {oui ? "Éclatée" : "Montée"}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Point de vue">
        {VUES.map((v) => (
          <button
            key={v.cle}
            type="button"
            aria-pressed={vue === v.cle}
            onClick={() => ouverte.current?.regarder(v.cle)}
            className="min-h-[44px] min-w-0 flex-1 rounded-full border-0 text-[15px]"
            style={bouton(vue === v.cle)}
          >
            {v.nom}
          </button>
        ))}
      </div>
    </div>
  );
}
