"use client";

import { useEffect, useRef, useState } from "react";
import { colors, font, libelleCaps } from "@/lib/design-tokens";

export type EtapeFiche = { key: string; href: string; label: string; meta: string; done: boolean };
export type VignettePhoto = { id: string; storageKey: string };

/**
 * Le tiroir du bas de la fiche chantier — la pellicule et les étapes.
 *
 * *Retenu par le patron le 10 août 2026 sur maquette
 * (`maquettes/atlas-note-vocale.html`, `docs/INTEGRER-ORIGINE.md` §6 bis).*
 *
 * Il affleure au repos — une poignée et une ligne de résumé — et monte d'un
 * doigt. L'écran de dessous recule, comme la feuille « Nouveau chantier » sur
 * l'accueil : c'est la profondeur qui dit « on est passé au-dessus », pas un
 * voile.
 *
 * **La ligne « Photos · 6 photos » a disparu, et c'est voulu.** Elle comptait
 * ce qui est désormais sous les yeux, et deux fois la même information sur un
 * écran, c'est une de trop.
 *
 * **La case « + » vient en PREMIER.** Posée en fin de pellicule, il fallait
 * faire défiler six photos pour la trouver : sur un téléphone, ajouter une
 * photo ne doit pas se mériter.
 */
export default function TiroirFiche({
  chantierId,
  photos,
  etapes,
  resume,
}: {
  chantierId: string;
  photos: VignettePhoto[];
  etapes: EtapeFiche[];
  /** Ce qu'on lit sans ouvrir : où en est le chantier, en deux mots. */
  resume: { gauche: string; droite: string };
}) {
  const [ouvert, setOuvert] = useState(false);

  // **Le tiroir se CLIPPE, il ne se déplace pas.**
  //
  // La première version le poussait sous l'écran d'un `translateY(100% -
  // 65px)`. En bornant sa hauteur, ce qui dépasse est exactement la prise —
  // quelle que soit l'encoche du téléphone ou la réserve du système.
  //
  // **Et il se pose sur la barre MESURÉE, pas sur `--atlas-barre`.** Cette
  // variable est une réserve de place (68 px), pas la hauteur que la barre
  // dessine (49 px) : le joint tombait dix-neuf pixels trop haut et une bande
  // de pellicule affleurait sous le résumé — on voyait le haut de deux photos
  // sans pouvoir les toucher. Corriger la variable aurait déplacé le cheveu de
  // la barre sur TOUS les écrans, dont l'accueil, que le patron a arrêté :
  // c'est le tiroir qui s'ajuste, pas la charte.
  const corps = useRef<HTMLDivElement>(null);
  const [hauteurOuverte, setHauteurOuverte] = useState(0);
  const [hauteurBarre, setHauteurBarre] = useState<number | null>(null);
  useEffect(() => {
    const mesurer = () => {
      // La prise compte dans la hauteur ouverte : elle reste à l'écran, elle
      // ne disparaît pas quand le tiroir monte.
      setHauteurOuverte(65 + (corps.current?.scrollHeight ?? 0));
      const barre = document.querySelector(".atlas-nav-basse");
      setHauteurBarre(barre ? barre.getBoundingClientRect().height : null);
    };
    mesurer();
    window.addEventListener("resize", mesurer);
    return () => window.removeEventListener("resize", mesurer);
  }, [photos.length, etapes.length]);

  // **L'écran de dessous RECULE quand le tiroir monte.** Même geste que la
  // feuille « Nouveau chantier » sur l'accueil : c'est la profondeur qui dit
  // « on est passé au-dessus », pas un voile. Sans elle, le tiroir tranchait
  // l'anneau en deux et l'écran paraissait cassé plutôt que superposé.
  //
  // L'état passe par un attribut sur la racine, et non par une propriété : la
  // fiche est un composant serveur, et le faire descendre obligerait à la
  // rendre cliente entière pour un `transform`.
  useEffect(() => {
    const racine = document.documentElement;
    racine.setAttribute("data-tiroir", ouvert ? "oui" : "non");
    return () => racine.removeAttribute("data-tiroir");
  }, [ouvert]);

  // Tant que la mesure n'a pas eu lieu (premier rendu, barre absente), la
  // réserve fait un repli honnête : le tiroir se pose trop haut plutôt que
  // sous la navigation, où sa prise deviendrait intouchable.
  const joint = hauteurBarre === null ? "var(--atlas-barre)" : `${hauteurBarre}px`;

  return (
    <div
      className="fixed inset-x-0 z-20 mx-auto max-w-md"
      style={{
        // **Le tiroir s'arrête AU-DESSUS de la barre du bas, il ne la
        // recouvre pas.** Posé à `bottom: 0`, sa prise passait sous la
        // navigation — qui est fixée au même niveau — et le tiroir ne
        // s'ouvrait plus du tout sous le doigt. Le premier essai l'a montré
        // en trente secondes ; aucun contrôle de rendu ne l'aurait vu.
        bottom: joint,
        // Au repos, seule la prise dépasse : 65 px, comme la maquette.
        height: ouvert ? Math.max(hauteurOuverte, 65) : 65,
        // Ouvert, il ne doit jamais dépasser l'écran : au-delà, ses dernières
        // étapes sortiraient par le haut sans que rien ne les rattrape.
        maxHeight: `calc(100dvh - ${joint} - 88px)`,
        transition: "height 0.5s cubic-bezier(0.22,0.61,0.36,1)",
        backgroundColor: colors.card,
        borderRadius: "24px 24px 0 0",
        boxShadow: "0 -18px 44px rgba(20,18,14,0.16)",
        overflowY: ouvert ? "auto" : "hidden",
      }}
      data-atlas="tiroir-fiche"
      data-ouvert={ouvert ? "oui" : "non"}
    >
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-label={ouvert ? "Refermer le détail du chantier" : "Ouvrir le détail du chantier"}
        // 65 px exactement — la hauteur de ce que le tiroir laisse dépasser au
        // repos. Sans hauteur fixe, la prise mesurait un peu moins que la
        // course du tiroir et une bande de pellicule affleurait sous le
        // résumé : on voyait le haut de deux photos sans pouvoir les toucher.
        className="block h-[65px] w-full px-[26px] pt-3.5"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {/* La poignée : trois pixels de haut, et c'est tout ce qui dit « ça se
            tire ». Elle se dessine en dur — un `border-radius` sur un élément
            sans hauteur ne se voyait pas. */}
        <span
          aria-hidden="true"
          className="mx-auto mb-[13px] block"
          style={{ width: 36, height: 3, borderRadius: 9, backgroundColor: colors.line }}
        />
        <span className="flex items-baseline justify-between text-[12.5px]" style={{ color: colors.muted }}>
          <span>{resume.gauche}</span>
          <span style={{ color: colors.ink }}>{resume.droite}</span>
        </span>
      </button>

      {/* Le talon laisse passer la bulle de l'assistant, fixée en bas à
          droite : sans lui, elle s'assoit sur la dernière étape et en mange le
          libellé. Vu en capture, jamais autrement — le tiroir défile, donc ce
          talon ne coûte rien d'autre qu'un peu de course. */}
      <div ref={corps} className="px-[26px] pb-[84px] pt-0.5">
        {/* La pellicule. Les marges négatives la font courir d'un bord à
            l'autre pendant que son contenu reste aligné sur les 26 px. */}
        <div className="atlas-pellicule -mx-[26px] mt-0.5 px-[26px] pb-4 pt-0.5">
          <a
            href={`/chantiers/${chantierId}/photos`}
            aria-label="Ajouter des photos"
            className="atlas-ajouter"
            style={{ border: `1px solid ${colors.line}`, color: colors.or }}
          >
            +
          </a>
          {photos.map((p, i) => (
            // Un lien, pas un bouton : ouvrir une photo est une navigation, et
            // elle doit rester ouvrable dans un nouvel onglet. Il s'enfonce
            // sous le doigt comme un bouton (`.atlas-vue:active`).
            <a
              key={p.id}
              href={`/chantiers/${chantierId}/photos`}
              aria-label={`Photo ${i + 1} sur ${photos.length}`}
              className="atlas-vue"
              style={{ backgroundColor: colors.cream }}
            >
              {/* Conservé en <img> : `next/image` réécrit le `src` via
                  `/_next/image`, ce qui romprait la correspondance exacte
                  attendue par la visionneuse (éprouvée de bout en bout). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/fichiers/${p.storageKey}`} alt="" className="h-full w-full object-cover" />
            </a>
          ))}
        </div>

        {etapes.map((s) => (
          <a
            key={s.key}
            href={s.href}
            className="flex items-baseline justify-between gap-4 py-3.5"
            style={{ borderTop: `1px solid ${colors.line}` }}
          >
            {/* L'intitulé ne se rétrécit jamais, la précision se replie.
                L'inverse — ce qu'on avait — donnait « À calculer, ou à écrire à
                la main » collé contre « Prix » puis débordant de l'écran : la
                maquette n'a que des précisions d'un mot, l'application a des
                phrases. */}
            <span
              className="flex-shrink-0 text-[19px] leading-[1.15]"
              style={{ color: colors.ink, fontFamily: font.display }}
            >
              {s.label}
            </span>
            <span
              className={`min-w-0 text-right ${libelleCaps}`}
              style={{ color: s.done ? colors.or : colors.muted }}
            >
              {s.meta}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
