"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { colors, surPhoto, surPlein, voile } from "@/lib/design-tokens";

/**
 * LA PHOTO EN GRAND — une seule visionneuse pour toute l'application.
 *
 * **Elle vivait dans la pellicule du chantier, et elle y était seule.** Le
 * 11 septembre 2026, le patron a demandé la même chose sur les retours
 * d'intervention : *« ce qui serait bien, c'est qu'on puisse cliquer dessus
 * pour qu'elle apparaisse en grand »*. La recopier aurait fait deux
 * visionneuses — donc deux façons de fermer, et un jour deux couleurs de fond
 * (`CLAUDE.md` §3). Elle a donc été sortie de `Pellicule` plutôt que
 * dupliquée, et la pellicule s'en sert désormais comme tout le monde.
 *
 * ─── UNE BIBLIOTHÈQUE, PAS UN PLEIN ÉCRAN — sa capture du même soir ─────────
 * *« C'est trop gros, faut pas qu'elle prenne tout l'écran. Comme sur les
 * sites internet : des flèches de chaque côté pour aller voir les suivantes,
 * et surtout une croix en haut à droite pour fermer. Une sorte de
 * bibliothèque. »* Puis, planche en main (`appli/photo-en-bibliotheque.html`,
 * variante « avec la rangée ») : *« Voilà je veux ça ! Et si on touche un
 * endroit hors de la photo ça ferme aussi. »*
 *
 * D'où ce qu'elle est maintenant : l'écran reste derrière un voile, la photo
 * vient dans un cadre au milieu, la croix est à droite, un chevron de chaque
 * côté, « 2 / 3 » dessous et la rangée des vignettes en bas. Le doigt glisse
 * aussi, et toucher le voile ferme. **Elle reçoit donc la LISTE et le rang**,
 * plus une seule clé : la suivante ne se devine pas depuis une photo seule.
 *
 * **Ce qui change d'un appelant à l'autre tient dans `children`** : la
 * pellicule y met « Retirer », les retours n'y mettent rien — on ne retire pas
 * depuis le compte rendu d'un salarié.
 *
 * ─── ELLE SORT PAR UN PORTAIL, ET IL LE FAUT ────────────────────────────────
 * Un tiroir ou une carte qui porte un `z-index` ouvre son propre contexte
 * d'empilement : rendue à l'intérieur, une visionneuse « plein écran » reste
 * plafonnée à ce niveau, et la barre de navigation — posée plus loin dans le
 * document — se peint par-dessus. On verrait « Chantiers / Planning » en
 * travers de la photo.
 *
 * ─── DEUX FONDS, DEUX RÈGLES DE COULEUR ─────────────────────────────────────
 * Le voile est de l'encre : presque noir sur les six chartes claires, CLAIR
 * sur Nuit et Sylve. Ce qui se pose SUR LE VOILE — la croix, le compte, la
 * rangée — s'écrit donc en `surPlein`, jamais en clair : une croix `#F6F1E6`
 * faisait 1,09 sur Nuit, et l'on ne voyait plus comment sortir.
 *
 * Les chevrons, eux, sont posés SUR LA PHOTO — et une photo ne change pas
 * avec la charte. Rendus en clair sur une photo claire, ils disparaissaient
 * (vu sur la planche avant de la livrer) : ils prennent `surPhoto`, un disque
 * sombre à glyphe clair qui ne suit aucune charte, et c'est délibéré.
 */
export default function VisionneusePhoto({
  photos,
  rang,
  onRang,
  onFermer,
  children,
}: {
  /** Les clés de stockage, dans l'ordre où les vignettes sont à l'écran. */
  photos: string[];
  /** Celle qu'on regarde, de 0 à `photos.length - 1`. */
  rang: number;
  onRang: (rang: number) => void;
  onFermer: () => void;
  /** Ce qui s'ajoute à gauche de la croix. Rien, le plus souvent. */
  children?: React.ReactNode;
}) {
  const depart = useRef<number | null>(null);
  const derniere = photos.length - 1;
  const precedente = () => rang > 0 && onRang(rang - 1);
  const suivante = () => rang < derniere && onRang(rang + 1);

  // Sur un ordinateur, les flèches feuillettent et Échap ferme — comme sur
  // les sites qu'il cite. Sans effet sur son téléphone, sans coût non plus.
  useEffect(() => {
    function auClavier(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
      if (e.key === "ArrowLeft") precedente();
      if (e.key === "ArrowRight") suivante();
    }
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  });

  // `document` n'existe pas au rendu serveur. Le garde ne masque aucun écart
  // d'hydratation : au premier rendu, aucune photo n'est ouverte — des deux
  // côtés.
  if (typeof document === "undefined") return null;

  const cle = photos[rang];
  if (cle === undefined) return null;
  const plusieurs = photos.length > 1;

  return createPortal(
    <div
      data-atlas="photo-en-grand"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: voile(colors.ink, 0.78) }}
      // Toucher le voile ferme — sa demande. Pas la photo, ni ce qui est posé
      // dessus : ceux-là arrêtent le clic avant qu'il n'arrive ici.
      onClick={onFermer}
      // Le doigt qui glisse : 40 px pour ne pas confondre avec un appui.
      onTouchStart={(e) => {
        depart.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const x0 = depart.current;
        depart.current = null;
        const x1 = e.changedTouches[0]?.clientX;
        if (x0 === null || x1 === undefined) return;
        if (x1 - x0 < -40) suivante();
        if (x1 - x0 > 40) precedente();
      }}
    >
      <div
        className="absolute left-4 right-4 top-8 flex items-center justify-end gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        <button
          onClick={onFermer}
          aria-label="Fermer"
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: voile(surPlein, 0.14) }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={surPlein} strokeWidth="2.2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="relative flex w-full max-w-[420px] items-center justify-center">
        {/* Conservé en <img> : dimensions intrinsèques inconnues à l'avance
            (photos de tailles arbitraires) dans un conteneur flexible non
            dimensionné. Et `next/image` réécrirait le `src` via `/_next/image`,
            or ces fichiers sortent d'une route gardée qui vérifie à qui ils
            appartiennent : ce serait un second chemin vers des photos de
            chantier. */}
        <img
          src={`/api/fichiers/${cle}`}
          alt=""
          data-atlas="photo-ouverte"
          className="max-h-[60vh] max-w-full rounded-[12px] object-contain"
          style={{ boxShadow: `0 18px 50px ${voile(colors.ink, 0.35)}` }}
          onClick={(e) => e.stopPropagation()}
        />
        {plusieurs && (
          <>
            <Chevron sens="precedente" eteint={rang === 0} onClick={precedente} />
            <Chevron sens="suivante" eteint={rang === derniere} onClick={suivante} />
          </>
        )}
      </div>

      {plusieurs && (
        <>
          <p
            className="mt-3.5 text-[13px] tabular-nums"
            style={{ color: surPlein, letterSpacing: "0.14em" }}
            data-atlas="rang-de-la-photo"
          >
            {rang + 1} / {photos.length}
          </p>
          {/* La rangée — le côté « bibliothèque » qu'il a retenu. Celle qu'on
              regarde est cerclée d'or, les autres sont éteintes. */}
          <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
            {photos.map((p, i) => (
              <button
                key={p}
                type="button"
                onClick={() => onRang(i)}
                aria-label={`Photo ${i + 1}`}
                aria-current={i === rang ? "true" : undefined}
                data-atlas="vignette-de-la-rangee"
                className="h-14 w-14 overflow-hidden rounded-[10px] p-0"
                style={{
                  opacity: i === rang ? 1 : 0.5,
                  boxShadow: i === rang ? `0 0 0 2px ${colors.orSurEncre}` : undefined,
                }}
              >
                <img src={`/api/fichiers/${p}`} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );
}

/**
 * Un chevron posé à cheval sur le bord de la photo. **Éteint plutôt que
 * retiré** au bout : un bouton qui disparaît fait chercher ce qui a bougé ; un
 * bouton pâle dit qu'il n'y a plus rien de ce côté.
 */
function Chevron({
  sens,
  eteint,
  onClick,
}: {
  sens: "precedente" | "suivante";
  eteint: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={eteint}
      aria-label={sens === "precedente" ? "Photo précédente" : "Photo suivante"}
      className={`absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full ${
        sens === "precedente" ? "-left-1.5" : "-right-1.5"
      }`}
      style={{ backgroundColor: surPhoto.fond, opacity: eteint ? 0.28 : 1 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={surPhoto.trait} strokeWidth="2.4">
        <path d={sens === "precedente" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
