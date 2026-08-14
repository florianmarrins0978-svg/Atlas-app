"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import {
  casesDUneForme,
  casesParTranche,
  cellulesDeNature,
  type FormeGrille,
  type Grilles,
  type Nature,
  type NomAxe,
} from "@/lib/grille-prix";
import {
  ajouterNatureAction,
  ajouterTechniqueAction,
  ajouterTrancheAction,
  poserPrixGrilleAction,
  rendreNatureAction,
  rendreTrancheAction,
  retirerNatureAction,
  retirerTrancheAction,
} from "./actions";

type Case = { nature: string; cle: string; prix: string; origine: "saisi" | "devis" };

/** Ce qu'on vient de ranger, et qui peut encore revenir. */
type Defaisable =
  | { quoi: "tranche"; axe: NomAxe; cle: string; nom: string; prix: number }
  | { quoi: "travail"; cle: string; nom: string; prix: number };

/**
 * « Mes prix » — les grilles du patron, et depuis le 14 août 2026 les siennes.
 *
 * **Sa demande :** *« je dois pouvoir ajouter ou retirer des cases. »* Les
 * titres, les aides et les formes ne sont plus écrits ici : ils viennent de
 * `lireGrilles`, qui rend les valeurs de départ tant qu'il n'a rien touché.
 * Deux listes finissent toujours par diverger (`CLAUDE.md` §3).
 *
 * **La grille de fendage, telle qu'on la remplit sur un téléphone.** Huit
 * colonnes de diamètres sur un écran de 393 pixels donneraient des colonnes de
 * quarante pixels : illisibles, et impossibles à viser du pouce. La grille est
 * donc dépliée en blocs — un par hauteur —, chacun listant ses diamètres. C'est
 * le même objet, dans l'ordre où l'on raisonne : on sait d'abord la taille de
 * l'arbre.
 *
 * **Les cases remplies se voient d'un coup d'œil**, et celles qui viennent d'un
 * devis réel le disent. Le patron doit pouvoir distinguer ce qu'il a décidé à
 * l'avance de ce qu'il a réellement pratiqué — les deux ne se valent pas quand
 * il s'agit de faire confiance à un chiffre.
 */
export default function GrillesPrixClient({
  initiales,
  grilles,
}: {
  initiales: Case[];
  grilles: Grilles;
}) {
  const [cases, setCases] = useState<Map<string, Case>>(
    new Map(initiales.map((c) => [`${c.nature}|${c.cle}`, c]))
  );
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [defaisable, setDefaisable] = useState<Defaisable | null>(null);
  const router = useRouter();

  async function poser(nature: string, cle: string, saisi: string) {
    const identifiant = `${nature}|${cle}`;
    const avant = cases.get(identifiant) ?? null;
    // Les mêmes tolérances que le serveur (`lireMontant`) : « 1 200 », « 250 € »,
    // « 250,50 ». Sans elles, l'écran effacerait une case que le serveur, lui,
    // aurait remplie — et le patron verrait son prix disparaître au moment même
    // où il le pose.
    const valeur = saisi.replace(/[\s  ]/g, "").replace("€", "").replace(",", ".");
    const montant = Number(valeur);
    const efface = valeur === "" || !Number.isFinite(montant) || montant <= 0;

    // Rien n'a changé : ne pas écrire, pour ne pas transformer une case posée à
    // la main en observation, ni réveiller une révision pour rien.
    if ((avant?.prix ?? "") === (efface ? "" : montant.toFixed(2))) return;

    setCases((m) => {
      const suivant = new Map(m);
      if (efface) suivant.delete(identifiant);
      else suivant.set(identifiant, { nature, cle, prix: montant.toFixed(2), origine: "saisi" });
      return suivant;
    });
    setErreur(null);

    try {
      await poserPrixGrilleAction(nature, cle, efface ? "" : String(montant));
    } catch {
      // On remet ce qui était là : un prix affiché mais pas enregistré est pire
      // qu'un prix absent — il se retrouverait sur un devis à la prochaine
      // dictée, et pas dans la grille.
      setCases((m) => {
        const suivant = new Map(m);
        if (avant) suivant.set(identifiant, avant);
        else suivant.delete(identifiant);
        return suivant;
      });
      setErreur("Ce prix n'a pas pu être enregistré. Réessayez.");
    }
  }

  const total = grilles.natures.reduce((n, g) => n + cellulesDeNature(g, grilles.axes).length, 0);

  return (
    <div className="mt-6 flex flex-col gap-6 px-6">
      <p className="text-[13px]" style={{ color: colors.muted }}>
        {cases.size === 0
          ? `Aucune case remplie sur ${total}. Atlas posera la question à chaque chantier, et rangera ici ce que vous répondez.`
          : `${cases.size} case${cases.size > 1 ? "s" : ""} remplie${cases.size > 1 ? "s" : ""} sur ${total}.`}
      </p>

      {/* Les mesures se règlent aussi à part, une fois pour toutes : c'est la
          même tranche de diamètre qui sert à abattre, à fendre et à dessoucher,
          et la voir trois fois ne dit pas qu'elle est unique. */}
      <Link
        href="/reglages/prix/mesures"
        className="text-[14px] font-medium"
        style={{ color: colors.rust }}
      >
        Régler mes mesures →
      </Link>

      {erreur && (
        <p role="alert" className="text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {grilles.natures.map((nature) => (
        <Section
          key={nature.cle}
          nature={nature}
          grilles={grilles}
          cases={cases}
          ouverte={ouverte}
          setOuverte={setOuverte}
          onPoser={poser}
          onErreur={setErreur}
          onRange={setDefaisable}
        />
      ))}

      <AjouterTravail axes={grilles.axes} onErreur={setErreur} />

      {defaisable && (
        <TiroirDuRetrait
          quoi={defaisable}
          onAnnuler={async () => {
            if (defaisable.quoi === "tranche") await rendreTrancheAction(defaisable.axe, defaisable.cle);
            else await rendreNatureAction(defaisable.cle);
            setDefaisable(null);
            router.refresh();
          }}
          onFermer={() => setDefaisable(null)}
        />
      )}
    </div>
  );
}

/** Une grille — son titre, ses cases, et les gestes qui la font changer de taille. */
function Section({
  nature,
  grilles,
  cases,
  ouverte,
  setOuverte,
  onPoser,
  onErreur,
  onRange,
}: {
  nature: Nature;
  grilles: Grilles;
  cases: Map<string, Case>;
  ouverte: string | null;
  setOuverte: (v: string | null) => void;
  onPoser: (nature: string, cle: string, saisi: string) => void;
  onErreur: (m: string | null) => void;
  onRange: (d: Defaisable) => void;
}) {
  const { axes } = grilles;
  const cellules = cellulesDeNature(nature, axes);
  const router = useRouter();

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[17px]" style={{ color: colors.ink, fontFamily: font.display }}>
          {nature.titre}
        </h2>
        {/* Retirer un travail entier. Il ne s'efface pas : ses prix restent en
            base et reviennent avec lui. */}
        <BoutonRetirer
          libelle={`Retirer le travail ${nature.titre}`}
          onRetirer={async () => {
            const r = await retirerNatureAction(nature.cle);
            onRange({ quoi: "travail", cle: nature.cle, nom: nature.titre, prix: r.prixEmportes });
            router.refresh();
          }}
          onErreur={onErreur}
        />
      </div>
      <p className="text-[13px] leading-snug" style={{ color: colors.muted }}>
        {nature.aide}
      </p>
      {!nature.integree && (
        // **La limite du geste, dite plutôt que découverte sur un devis.** Le
        // chiffrage sait retrouver un abattage ou une fente dans une dictée ;
        // il ne sait pas retrouver « le broyage des branches ».
        <p className="text-[12px] leading-snug" style={{ color: colors.muted }}>
          Ce travail est à vous : Atlas y range vos prix et vous les relit, mais il ne le reconnaîtra pas tout seul
          dans une note vocale.
        </p>
      )}

      {/* Une seule case : la déplier dans un accordéon serait un geste de plus
          pour un seul champ. */}
      {nature.forme === "une-case" ? (
        <div className="rounded-[4px] px-4 py-3" style={{ backgroundColor: colors.card }}>
          <Champ
            nature={nature.cle}
            cle={cellules[0].cle}
            libelle={cellules[0].libelle}
            contexte={nature.titre}
            posee={cases.get(`${nature.cle}|${cellules[0].cle}`)}
            onPoser={onPoser}
          />
        </div>
      ) : nature.forme === "un-axe" ? (
        /* Un seul axe : pas d'accordéon non plus. Replier huit champs derrière
           un appui, quand il n'y a qu'une rangée, ajouterait un geste sans rien
           ranger. */
        <div className="flex flex-col gap-2 rounded-[4px] px-4 py-3" style={{ backgroundColor: colors.card }}>
          <span className={smallCaps} style={{ color: colors.muted }}>
            {nature.axe}
          </span>
          {axes.diametres.map((diametre) => (
            <Champ
              key={diametre.cle}
              nature={nature.cle}
              cle={diametre.cle}
              libelle={diametre.libelle}
              contexte={nature.titre}
              posee={cases.get(`${nature.cle}|${diametre.cle}`)}
              onPoser={onPoser}
              surRetrait={{
                axe: "diametre",
                cle: diametre.cle,
                nom: diametre.libelle,
                onRange,
                onErreur,
              }}
            />
          ))}
          <AjouterTranche axe="diametre" grilles={grilles} onErreur={onErreur} />
        </div>
      ) : (
        <>
          {rangeesDe(nature, grilles).map((rangee) => {
            const identifiantRangee = `${nature.cle}|${rangee.cle}`;
            const ouvert = ouverte === identifiantRangee;
            const posees = axes.diametres.filter((d) =>
              cases.has(`${nature.cle}|${rangee.cle}|${d.cle}`)
            ).length;
            return (
              <div key={identifiantRangee} className="rounded-[4px]" style={{ backgroundColor: colors.card }}>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setOuverte(ouvert ? null : identifiantRangee)}
                    aria-expanded={ouvert}
                    className="flex flex-1 items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-[15px] font-medium" style={{ color: colors.ink }}>
                      {rangee.titre}
                    </span>
                    <span className="text-[12px]" style={{ color: posees > 0 ? colors.rust : colors.muted }}>
                      {posees} / {axes.diametres.length}
                    </span>
                  </button>
                  <div className="pr-2">
                    <BoutonRetirer
                      libelle={`Retirer ${rangee.titre}`}
                      onRetirer={async () => {
                        const r = await retirerTrancheAction(rangee.axe, rangee.cle);
                        onRange({
                          quoi: "tranche",
                          axe: rangee.axe,
                          cle: rangee.cle,
                          nom: rangee.titre,
                          prix: r.prixEmportes,
                        });
                        router.refresh();
                      }}
                      onErreur={onErreur}
                    />
                  </div>
                </div>

                {ouvert && (
                  <div className="flex flex-col gap-2 px-4 pb-4">
                    <span className={smallCaps} style={{ color: colors.muted }}>
                      {nature.axe}
                    </span>
                    {axes.diametres.map((diametre) => {
                      const cle = `${rangee.cle}|${diametre.cle}`;
                      return (
                        <Champ
                          key={cle}
                          nature={nature.cle}
                          cle={cle}
                          libelle={diametre.libelle}
                          contexte={`${nature.titre} — ${rangee.titre}`}
                          posee={cases.get(`${nature.cle}|${cle}`)}
                          onPoser={onPoser}
                          surRetrait={{
                            axe: "diametre",
                            cle: diametre.cle,
                            nom: diametre.libelle,
                            onRange,
                            onErreur,
                          }}
                        />
                      );
                    })}
                    <AjouterTranche axe="diametre" grilles={grilles} onErreur={onErreur} />
                  </div>
                )}
              </div>
            );
          })}

          {nature.forme === "technique-diametre" ? (
            <AjouterTechnique onErreur={onErreur} />
          ) : (
            <AjouterTranche axe="hauteur" grilles={grilles} onErreur={onErreur} />
          )}
        </>
      )}
    </section>
  );
}

/**
 * Les rangées d'une grille à deux entrées.
 *
 * L'abattage se déplie par TECHNIQUE, le fendage par HAUTEUR — les deux se
 * referment sur les mêmes diamètres. C'est ce que le patron a choisi : chez
 * lui, la technique fait passer un abattage de 600 à 1 400 €, et la hauteur ne
 * décide de rien.
 */
function rangeesDe(nature: Nature, grilles: Grilles): { cle: string; titre: string; axe: NomAxe }[] {
  if (nature.forme === "technique-diametre") {
    return grilles.axes.techniques.map((t) => ({
      cle: t.cle,
      titre: t.libelle[0].toUpperCase() + t.libelle.slice(1),
      axe: "technique" as const,
    }));
  }
  return grilles.axes.hauteurs.map((h) => ({ cle: h.cle, titre: `Arbre ${h.libelle}`, axe: "hauteur" as const }));
}

/**
 * « + Ajouter une tranche » — et la conséquence DITE avant de valider.
 *
 * Une tranche de diamètre sert à trois grilles : l'ajouter en pose dix d'un
 * coup. Un écran qui le tait transforme un geste anodin en dix questions
 * surprises au chantier suivant.
 */
function AjouterTranche({
  axe,
  grilles,
  onErreur,
}: {
  axe: NomAxe;
  grilles: Grilles;
  onErreur: (m: string | null) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [de, setDe] = useState("");
  const [a, setA] = useState("");
  const [enCours, setEnCours] = useState(false);
  const router = useRouter();
  const unite = axe === "hauteur" ? "m" : "cm";
  const mot = axe === "hauteur" ? "hauteur" : "tranche de diamètre";

  // Ce que cette tranche ajoutera — calculé par la règle pure, jamais écrit à
  // la main : un nombre faux ici serait pire que pas de nombre du tout.
  const consequence = casesParTranche(axe, grilles);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex min-h-[44px] w-full items-center gap-2 py-2 text-left text-[14px] font-medium"
        style={{ color: colors.rust }}
      >
        <span className="text-[17px] leading-none">+</span> Ajouter une {mot}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex items-center gap-2">
        <input
          value={de}
          onChange={(e) => setDe(e.target.value)}
          inputMode="decimal"
          placeholder={`de 90`}
          aria-label={`Borne basse, en ${unite}`}
          className="min-w-0 flex-1 rounded-[4px] border-0 px-3 py-2.5 outline-none"
          style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
        />
        <input
          value={a}
          onChange={(e) => setA(e.target.value)}
          inputMode="decimal"
          placeholder={`à 120`}
          aria-label={`Borne haute, en ${unite} — vide pour « et plus »`}
          className="min-w-0 flex-1 rounded-[4px] border-0 px-3 py-2.5 outline-none"
          style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
        />
        <button
          type="button"
          disabled={enCours}
          onClick={async () => {
            setEnCours(true);
            onErreur(null);
            const borneBasse = Number(de.replace(",", "."));
            const borneHaute = a.trim() === "" ? null : Number(a.replace(",", "."));
            const r = await ajouterTrancheAction(axe, borneBasse, borneHaute);
            setEnCours(false);
            if (!r.ok) {
              onErreur(r.raison);
              return;
            }
            router.refresh();
          }}
          className="min-h-[40px] rounded-full px-4 py-2 text-[14px] font-medium disabled:opacity-40"
          style={{ backgroundColor: colors.rust, color: colors.card }}
        >
          Ajouter
        </button>
      </div>
      <p className="rounded-[4px] px-3 py-2 text-[12px] leading-snug" style={{ backgroundColor: colors.rustTint, color: colors.inkSoft }}>
        {consequence.total > 0
          ? `Cette ${mot} ajoutera ${consequence.total} case${consequence.total > 1 ? "s" : ""} en tout — ${consequence.parNature
              .map((x) => x.nature.titre.toLowerCase())
              .join(", ")}.`
          : "Cette tranche n'ajoutera aucune case : aucune grille ne s'en sert."}
      </p>
    </div>
  );
}

/** « + Ajouter une façon d'abattre » : un nom, et rien d'autre à décider. */
function AjouterTechnique({ onErreur }: { onErreur: (m: string | null) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [enCours, setEnCours] = useState(false);
  const router = useRouter();

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex min-h-[44px] w-full items-center gap-2 py-2 text-left text-[14px] font-medium"
        style={{ color: colors.rust }}
      >
        <span className="text-[17px] leading-none">+</span> Ajouter une façon d&apos;abattre
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Abattage par câble"
        aria-label="Nom de la façon d'abattre"
        className="min-w-0 flex-1 rounded-[4px] border-0 px-3 py-2.5 outline-none"
        style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
      />
      <button
        type="button"
        disabled={enCours}
        onClick={async () => {
          setEnCours(true);
          onErreur(null);
          const r = await ajouterTechniqueAction(nom);
          setEnCours(false);
          if (!r.ok) {
            onErreur(r.raison);
            return;
          }
          router.refresh();
        }}
        className="min-h-[40px] rounded-full px-4 py-2 text-[14px] font-medium disabled:opacity-40"
        style={{ backgroundColor: colors.rust, color: colors.card }}
      >
        Ajouter
      </button>
    </div>
  );
}

/** « + Ajouter un travail » : son nom, et comment son prix se décide. */
function AjouterTravail({
  axes,
  onErreur,
}: {
  axes: Grilles["axes"];
  onErreur: (m: string | null) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [forme, setForme] = useState<FormeGrille>("une-case");
  const [enCours, setEnCours] = useState(false);
  const router = useRouter();

  const FORMES: { valeur: FormeGrille; titre: string; quoi: string }[] = [
    { valeur: "une-case", titre: "Un seul prix", quoi: "multiplié par une quantité — comme la haie, au mètre" },
    { valeur: "un-axe", titre: "Par diamètre", quoi: "une case par tranche — comme le dessouchage" },
    {
      valeur: "technique-diametre",
      titre: "Par façon de faire et par diamètre",
      quoi: "croisé — comme l'abattage",
    },
  ];

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex min-h-[44px] w-full items-center gap-2 text-left text-[14px] font-medium"
        style={{ color: colors.rust }}
      >
        <span className="text-[17px] leading-none">+</span> Ajouter un travail
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[4px] px-4 py-4" style={{ backgroundColor: colors.card }}>
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Broyer les branches"
        aria-label="Nom du travail"
        className="rounded-[4px] border-0 px-3 py-2.5 outline-none"
        style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
      />
      <p className="text-[12.5px]" style={{ color: colors.muted }}>
        Comment son prix se décide :
      </p>
      <div role="radiogroup" aria-label="Comment son prix se décide" className="flex flex-col gap-2">
        {FORMES.map((f) => (
          <button
            key={f.valeur}
            type="button"
            role="radio"
            aria-checked={forme === f.valeur}
            onClick={() => setForme(f.valeur)}
            className="flex min-h-[44px] items-start gap-2.5 rounded-[4px] px-3 py-2.5 text-left"
            style={{ backgroundColor: colors.cream }}
          >
            <span
              aria-hidden
              className="mt-[3px] h-[18px] w-[18px] flex-none rounded-full"
              style={{
                border: `1.5px solid ${forme === f.valeur ? colors.rust : colors.muted}`,
                backgroundColor: forme === f.valeur ? colors.rust : "transparent",
                boxShadow: forme === f.valeur ? `inset 0 0 0 3px ${colors.cream}` : undefined,
              }}
            />
            <span className="min-w-0">
              <span className="block text-[14px] font-medium" style={{ color: colors.ink }}>
                {f.titre}
              </span>
              <span className="text-[12px]" style={{ color: colors.muted }}>
                {f.quoi} : {casesDUneForme(f.valeur, axes)} case
                {casesDUneForme(f.valeur, axes) > 1 ? "s" : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={enCours}
        onClick={async () => {
          setEnCours(true);
          onErreur(null);
          const r = await ajouterNatureAction(nom, forme);
          setEnCours(false);
          if (!r.ok) {
            onErreur(r.raison);
            return;
          }
          router.refresh();
        }}
        className="min-h-[44px] self-start rounded-full px-5 py-2.5 text-[14px] font-medium disabled:opacity-40"
        style={{ backgroundColor: colors.rust, color: colors.card }}
      >
        Ajouter ce travail
      </button>
    </div>
  );
}

/**
 * La croix du retrait.
 *
 * **36 px de côté, et pas moins :** c'est une cible isolée dans une ligne
 * serrée, visée du pouce sur un chantier.
 */
function BoutonRetirer({
  libelle,
  onRetirer,
  onErreur,
}: {
  libelle: string;
  onRetirer: () => Promise<void>;
  onErreur: (m: string | null) => void;
}) {
  const [enCours, setEnCours] = useState(false);
  return (
    <button
      type="button"
      aria-label={libelle}
      disabled={enCours}
      onClick={async () => {
        setEnCours(true);
        onErreur(null);
        try {
          await onRetirer();
        } catch {
          onErreur("Ce retrait n'a pas pu être enregistré. Réessayez.");
        } finally {
          setEnCours(false);
        }
      }}
      className="flex h-9 w-9 flex-none items-center justify-center text-[17px] disabled:opacity-40"
      style={{ color: colors.muted }}
    >
      ×
    </button>
  );
}

/**
 * Ce qu'un retrait vient de ranger, et le moyen de le défaire.
 *
 * **Il dit COMBIEN de prix partent avec.** Un retrait muet laisse croire qu'on
 * n'a rien perdu ; ces prix sont ses décisions, et certains viennent de devis
 * réels que rien ne reconstituerait.
 */
function TiroirDuRetrait({
  quoi,
  onAnnuler,
  onFermer,
}: {
  quoi: Defaisable;
  onAnnuler: () => void;
  onFermer: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-[4px] px-4 py-3"
      style={{ backgroundColor: colors.rust, color: colors.card }}
    >
      <span className="flex-1 text-[12.5px] leading-snug">
        {quoi.nom} retiré{quoi.quoi === "tranche" ? "e" : ""}
        {quoi.prix > 0
          ? ` — ${quoi.prix} prix rangé${quoi.prix > 1 ? "s" : ""} avec ${quoi.quoi === "tranche" ? "elle" : "lui"}.`
          : " — aucun prix n'était posé."}
      </span>
      <button
        type="button"
        onClick={onAnnuler}
        className="min-h-9 rounded-full px-4 py-2 text-[13px] font-semibold"
        style={{ backgroundColor: colors.card, color: colors.rust }}
      >
        Annuler
      </button>
      <button type="button" onClick={onFermer} aria-label="Fermer" className="h-9 w-9 flex-none text-[17px]">
        ×
      </button>
    </div>
  );
}

/** Une case : son intitulé, son prix, et d'où il vient. */
function Champ({
  nature,
  cle,
  libelle,
  contexte,
  posee,
  onPoser,
  surRetrait,
}: {
  nature: string;
  cle: string;
  libelle: string;
  /**
   * De quelle grille et de quelle rangée vient ce champ.
   *
   * **Rendu nécessaire le 8 août 2026 par l'arrivée du dessouchage :** « 40 à
   * 50 cm » désigne désormais deux cases à l'écran — un tronc à fendre et une
   * souche à arracher. Le libellé visible reste court, parce que la colonne de
   * gauche dit déjà de quelle grille il s'agit ; c'est le nom ACCESSIBLE qui
   * porte le contexte entier. Sans lui, une personne qui n'utilise pas ses yeux
   * entend cinq fois « 40 à 50 cm » sans savoir lequel elle remplit.
   */
  contexte: string;
  posee: Case | undefined;
  onPoser: (nature: string, cle: string, saisi: string) => void;
  /** Présent, la ligne porte la croix qui retire SA TRANCHE — pas la case seule. */
  surRetrait?: {
    axe: NomAxe;
    cle: string;
    nom: string;
    onRange: (d: Defaisable) => void;
    onErreur: (m: string | null) => void;
  };
}) {
  const identifiant = `prix-${nature}-${cle.replace(/\|/g, "-")}`;
  const router = useRouter();
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={identifiant} className="flex-1 text-[14px]" style={{ color: colors.ink }}>
        {libelle}
      </label>
      {/* D'où vient ce prix : ce qu'il a décidé, ou ce qu'il a pratiqué. Les
          deux ne se valent pas quand il s'agit d'y faire confiance. */}
      {posee?.origine === "devis" && (
        <span className="text-[11px]" style={{ color: colors.muted }}>
          d&apos;un devis
        </span>
      )}
      <input
        id={identifiant}
        aria-label={`${contexte} — ${libelle}`}
        type="text"
        inputMode="decimal"
        defaultValue={posee ? String(Number(posee.prix)) : ""}
        placeholder="—"
        onBlur={(e) => onPoser(nature, cle, e.target.value)}
        className="w-24 rounded-[4px] px-3 py-2 text-right text-[14px]"
        style={{
          backgroundColor: colors.cream,
          color: colors.ink,
          border: `1px solid ${posee ? "transparent" : colors.rustTint}`,
        }}
      />
      <span className="text-[13px]" style={{ color: colors.muted }}>
        €
      </span>
      {surRetrait && (
        <BoutonRetirer
          libelle={`Retirer la tranche ${surRetrait.nom}`}
          onErreur={surRetrait.onErreur}
          onRetirer={async () => {
            const r = await retirerTrancheAction(surRetrait.axe, surRetrait.cle);
            surRetrait.onRange({
              quoi: "tranche",
              axe: surRetrait.axe,
              cle: surRetrait.cle,
              nom: surRetrait.nom,
              prix: r.prixEmportes,
            });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
