"use client";

import { useMemo, useState } from "react";
import { colors, font, surPlein } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import {
  anneesDesRetours,
  compteDesTaches,
  rangerLesRetours,
  type RetourEnListe,
} from "@/lib/retour-intervention";

/**
 * LA LISTE DES RETOURS — rangée par client, filtrée d'un doigt.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CET ÉCRAN NE DÉCIDE DE RIEN.** Ce qui range, ce qui filtre et ce qui compte
 * vit dans `src/lib/retour-intervention.ts` et s'éprouve sans navigateur. Ici
 * on affiche, et l'on choisit où le doigt se pose.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI PAR CLIENT** — sa demande, et sa raison valait mieux que celle
 * qu'on défendait : un retour se garde des ANNÉES. Rangés par date, les deux
 * passages chez le même homme seraient à quinze mois d'écart dans la liste ;
 * rangés par client, ils se lisent côte à côte — et c'est ainsi qu'on retrouve
 * ce qu'on avait fait la dernière fois.
 *
 * **Deux filtres, et ils font deux métiers.** Le champ sert quand il sait qui
 * il cherche ; les années servent quand il ne sait plus quand. Un seul des deux
 * l'aurait obligé à taper de mémoire, avec des doigts épais.
 */
export default function ListeDesRetours({ retours }: { retours: RetourEnListe[] }) {
  const [cherche, setCherche] = useState("");
  const [annee, setAnnee] = useState<string | null>(null);

  const annees = useMemo(() => anneesDesRetours(retours), [retours]);
  const groupes = useMemo(
    () => rangerLesRetours(retours, { client: cherche, annee }),
    [retours, cherche, annee]
  );

  return (
    <div className="pb-10" data-atlas="liste-des-retours">
      <EnTeteEcran titre="Retours d'intervention" retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }}
        allure="commune" />

      {/* **Le champ d'abord, les années ensuite.** Quand il sait qui il cherche,
          il tape ; le reste du temps il touche une année. L'ordre inverse
          l'aurait fait lire trois pastilles avant d'arriver à ce qu'il voulait. */}
      <div className="relative mx-[22px] mt-4">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
          style={{ color: colors.muted }}
        >
          <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
            <circle cx="7.6" cy="7.6" r="5.4" stroke="currentColor" strokeWidth="1.6" />
            <path d="m11.6 11.6 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          value={cherche}
          onChange={(e) => setCherche(e.target.value)}
          placeholder="Un nom de client"
          aria-label="Chercher un client"
          data-atlas="chercher-un-client"
          className="h-12 w-full rounded-full border-0 pl-11 pr-4 text-[16px] outline-none"
          style={{
            backgroundColor: colors.card,
            color: colors.ink,
            boxShadow: `inset 0 0 0 1px ${colors.line}`,
          }}
        />
      </div>

      {/* **`flex-none` sur la rangée, et ce n'est pas décoratif** : dans une
          colonne flexible, une rangée qui défile horizontalement se laisse
          écraser à zéro pixel. Elle répond alors au doigt sans s'afficher nulle
          part — payé sur la maquette du 8 septembre, vu à la capture. */}
      {annees.length > 1 && (
        <div
          className="mt-2.5 flex flex-none gap-[7px] overflow-x-auto px-[22px]"
          style={{ scrollbarWidth: "none" }}
          data-atlas="annees-des-retours"
        >
          <Pastille actif={annee === null} onClick={() => setAnnee(null)}>
            Tout
          </Pastille>
          {annees.map((a) => (
            <Pastille key={a} actif={annee === a} onClick={() => setAnnee(a)}>
              {a}
            </Pastille>
          ))}
        </div>
      )}

      {groupes.length === 0 ? (
        <p className="mx-[22px] mt-7 text-[13.5px] leading-[1.65]" style={{ color: colors.muted }}>
          {retours.length === 0
            ? "Rien encore. Un retour arrive ici quand un salarié pose « c'est fini » sur sa fiche."
            : "Aucun retour ne correspond."}
        </p>
      ) : (
        groupes.map((groupe) => (
          <section key={groupe.client} className="mt-6" data-atlas="groupe-de-retours">
            <p
              className="mx-[22px] mb-0 text-[19px] leading-[1.2]"
              style={{ fontFamily: font.display }}
            >
              {groupe.client}
            </p>
            {groupe.retours.map((r) => (
              <Carte key={r.id} retour={r} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function Pastille({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      // Quarante pixels : la mesure que tout le reste de l'application tient
      // pour un pouce. Les serrer pour faire tenir une année de plus se paierait
      // à chaque appui, sur un écran sale.
      className="h-10 flex-none rounded-full px-[15px] text-[13.5px]"
      style={
        actif
          ? { backgroundColor: colors.plein, color: surPlein, WebkitTapHighlightColor: "transparent" }
          : {
              backgroundColor: "transparent",
              color: colors.inkSoft,
              boxShadow: `inset 0 0 0 1px ${colors.line}`,
              WebkitTapHighlightColor: "transparent",
            }
      }
    >
      {children}
    </button>
  );
}

/** Un retour, sur la liste — et le chemin vers le chantier qui le porte. */
function Carte({ retour }: { retour: RetourEnListe }) {
  const compte = compteDesTaches(retour.taches);
  const jour = new Date(retour.poseLe).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    // **CE N'EST PAS UN LIEN, ET C'EST DÉLIBÉRÉ.** Le chantier d'un retour
    // s'ouvre sur sa facture — mais l'adresse dépend de son état, et cette règle
    // vit déjà dans `portesDuPlanning`. La recopier ici ferait la seconde vérité
    // que `CLAUDE.md` §3 interdit. Un faux lien, lui, promettrait un geste qui
    // ne se passe pas : une carte qui ne mène nulle part n'a pas à ressembler à
    // une porte. La question est ouverte dans `TODO.md`.
    <div
      data-atlas="carte-de-retour"
      className="mx-[22px] mt-2.5 flex items-start gap-3 rounded-[13px] px-3.5 py-3"
      style={{
        backgroundColor: colors.card,
        color: colors.ink,
        boxShadow: `inset 0 0 0 1px ${colors.line}`,
      }}
    >
      <span
        aria-hidden="true"
        className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full"
        style={{ backgroundColor: colors.rustTint, color: colors.orTexte }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path
            d="M3 8.4 6.3 11.7 13 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium leading-[1.3]">{jour}</span>
        <span className="mt-[3px] block text-[12.5px] leading-[1.45]" style={{ color: colors.muted }}>
          {[retour.posePar, compte, phrasePhotos(retour.photos)].filter(Boolean).join(" · ")}
        </span>
        {/* Son mot, quand il en a écrit un. Une case vide intitulée
            « À signaler » laisserait croire qu'on a perdu ce qu'il a dit. */}
        {retour.aSignaler && (
          <span
            className="mt-1.5 block text-[13px] leading-[1.45]"
            style={{ color: colors.inkSoft }}
          >
            « {retour.aSignaler} »
          </span>
        )}
      </span>
    </div>
  );
}

/** « 3 photos », « 1 photo », ou rien du tout. */
function phrasePhotos(combien: number): string {
  if (combien === 0) return "";
  return combien === 1 ? "1 photo" : `${combien} photos`;
}
