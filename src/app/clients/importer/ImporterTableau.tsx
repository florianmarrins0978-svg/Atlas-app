"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, voile } from "@/lib/design-tokens";
import CocheRonde from "@/components/atlas/reglages/CocheRonde";
import { jourCourt } from "@/lib/documents-du-client";
import { enEuros } from "@/lib/euros";
import { dateCitee } from "@/lib/mois";
import {
  CHAMPS_DU_TABLEAU,
  chantierDeLaLigne,
  compteDesClients,
  grouperParClient,
  jourDuTableau,
  lireLignes,
  ordreDesDates,
  planDeRangement,
  reconnaitreColonnes,
  reglagesDesDecisions,
  type ChampDuTableau,
  type ChoixAdresse,
  type ClientConnu,
  type Groupe,
  type LigneLue,
  type OrdreDate,
} from "@/lib/import-tableau";

/**
 * IMPORTER UN TABLEAU — l'écran de sa planche du 28 octobre 2026
 * (`appli/soignee/clients-importer.html`, « Le tableau lu » et « Atlas
 * hésite »).
 *
 * **Les libellés ne se montrent que quand Atlas hésite** : *« pourquoi je peux
 * modifier les libellés ? »*, puis *« lorsque Atlas hésite, il faut qu'il nous
 * ressorte les libellés modifiables, seulement quand il hésite »*. Tant qu'une
 * colonne attend, rien d'autre ne s'affiche et rien ne se range.
 *
 * **Zéro erreur sur une adresse** : un client à deux adresses, ou dont la fiche
 * dit une autre adresse, passe en tête avec sa question, et « Ranger » attend.
 *
 * **Les règles ne vivent pas ici** (`src/lib/import-tableau.ts`) : le serveur
 * refait le même plan avec les mêmes fonctions avant de ranger, et refuse ce
 * que l'écran aurait laissé passer.
 */

/** Combien de clients sans question se montrent : au-delà, une phrase les compte. */
const MONTRES = 30;

const nombre = (n: number) => n.toLocaleString("fr-FR");

/** « ML » pour Mme Lenoir, comme sur la planche. */
function initiales(nom: string): string {
  const mots = nom.replace(/\bet\b/g, "").split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  return (mots.length === 1 ? mots[0][0] : mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
}

export default function ImporterTableau({
  fichier,
  grille,
  connus,
  autreFichier,
}: {
  fichier: File;
  grille: string[][];
  connus: ClientConnu[];
  /** Revenir au choix du fichier. */
  autreFichier: () => void;
}) {
  const router = useRouter();
  const reconnaissance = useMemo(() => reconnaitreColonnes(grille[0], grille.slice(1)), [grille]);
  const [colonnes, setColonnes] = useState<Partial<Record<ChampDuTableau, number | null>>>({});
  const [genreFixe, setGenreFixe] = useState<"devis" | "facture" | null>(null);
  const [ordreDate, setOrdreDate] = useState<OrdreDate | null>(null);
  const [choix, setChoix] = useState<Record<string, ChoixAdresse>>({});
  const [tapes, setTapes] = useState<Record<number, string>>({});
  const [envoi, setEnvoi] = useState<{ quoi: "pret" } | { quoi: "en-cours" } | { quoi: "refus"; raison: string }>({ quoi: "pret" });

  const decision = useMemo(() => reglagesDesDecisions(grille, { colonnes, ordreDate, genreFixe }), [grille, colonnes, ordreDate, genreFixe]);
  const lecture = useMemo(() => (decision.ok ? lireLignes(grille, decision.reglages) : null), [grille, decision]);
  const { groupes, sansNom } = useMemo(
    () => (lecture ? grouperParClient(lecture.lignes, connus, choix) : { groupes: [] as Groupe[], sansNom: [] as LigneLue[] }),
    [lecture, connus, choix]
  );
  const plan = useMemo(() => (lecture ? planDeRangement(lecture.lignes, connus, choix, tapes) : null), [lecture, connus, choix, tapes]);
  const compte = compteDesClients(groupes);
  const sansNomRestant = sansNom.filter((l) => !(tapes[l.rang] ?? "").trim()).length;

  // La colonne Date retenue, et ce qu'elle porte : de quoi poser la question
  // « 3 avril ou 4 mars ? » sur SA première date ambiguë.
  const colDate = colonnes["Date"] === undefined ? reconnaissance.colonnes["Date"] : (colonnes["Date"] ?? undefined);
  const datesDouteuses = colDate !== undefined && ordreDesDates(grille.slice(1).map((l) => l[colDate] ?? "")) === "doute";
  const exempleDate = datesDouteuses ? grille.slice(1).map((l) => l[colDate!] ?? "").find((v) => jourDuTableau(v, "jma") && jourDuTableau(v, "mja")) : undefined;
  const montrerColonnes = reconnaissance.hesite.length > 0 || datesDouteuses;

  const aRanger = plan?.ok ? plan.clients.reduce((t, c) => t + c.pieces.length, 0) : 0;
  const bouton = !decision.ok
    ? decision.manque
    : plan && !plan.ok
      ? `Vérifiez ${plan.adresses} adresse${plan.adresses > 1 ? "s" : ""}`
      : `Ranger ${nombre(aRanger)} document${aRanger > 1 ? "s" : ""}`;
  const peutRanger = decision.ok && !!plan?.ok && aRanger > 0 && envoi.quoi !== "en-cours";

  async function ranger() {
    if (!peutRanger) return;
    setEnvoi({ quoi: "en-cours" });
    const corps = new FormData();
    corps.set("fichier", fichier);
    corps.set("decisions", JSON.stringify({ colonnes, ordreDate, genreFixe, choix, tapes }));
    const r = await fetch("/api/pieces-importees/tableau", { method: "POST", body: corps })
      .then((x) => x.json() as Promise<{ ok: boolean; raison?: string; rangees?: number; dejaLa?: number }>)
      .catch(() => ({ ok: false, raison: "Le réseau ne répond pas. Réessayez." }) as { ok: boolean; raison?: string; rangees?: number; dejaLa?: number });
    if (!r.ok) {
      setEnvoi({ quoi: "refus", raison: r.raison ?? "Le tableau n'a pas pu être rangé. Réessayez." });
      return;
    }
    if (!r.rangees) {
      setEnvoi({ quoi: "refus", raison: `Ces ${nombre(r.dejaLa ?? aRanger)} pièces sont déjà dans Atlas : rien de nouveau à ranger.` });
      return;
    }
    // « N documents rangés », et « Annuler », sur Vos clients (`BandeImport`).
    router.push("/clients");
    router.refresh();
  }

  const avecQuestion = groupes.filter((g) => g.conflit);
  const sansQuestion = groupes.filter((g) => !g.conflit);
  const montres = sansQuestion.slice(0, MONTRES);
  const autres = sansQuestion.slice(MONTRES);

  return (
    <section className="mx-[26px] mt-[10px] pb-[110px]" data-atlas="import-tableau">
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
        {fichier.name}
      </p>
      <p className="mt-[6px] text-[26px] leading-[1.15]" style={{ fontFamily: font.display }}>
        {nombre(grille.length - 1)} lignes lues
      </p>

      {!lecture && (
        <div className="mt-[12px] flex flex-wrap gap-2" data-atlas="bilan-tableau">
          <Etat ton="ambre">Une colonne à vérifier</Etat>
        </div>
      )}
      {lecture && (
        <div className="mt-[12px] flex flex-wrap gap-2" data-atlas="bilan-tableau">
          <Etat>{nombre(lecture.devis)} devis</Etat>
          <Etat>
            {nombre(lecture.factures)} facture{lecture.factures > 1 ? "s" : ""}
          </Etat>
          {compte.nouveaux > 0 && (
            <Etat ton="vert">
              {nombre(compte.nouveaux)} nouveau{compte.nouveaux > 1 ? "x" : ""} client{compte.nouveaux > 1 ? "s" : ""}
            </Etat>
          )}
          {compte.deja > 0 && (
            <Etat>
              {nombre(compte.deja)} déjà client{compte.deja > 1 ? "s" : ""}
            </Etat>
          )}
          {lecture.doubles > 0 && <Etat>{nombre(lecture.doubles)} en double</Etat>}
          {compte.aVerifier > 0 && (
            <Etat ton="ambre">
              {compte.aVerifier} adresse{compte.aVerifier > 1 ? "s" : ""} à vérifier
            </Etat>
          )}
          {/* Un nom tapé retire sa pièce du compte : elle se range (comme sur la planche). */}
          {sansNomRestant > 0 && <Etat ton="ambre">{nombre(sansNomRestant)} sans nom</Etat>}
          {lecture.ignorees > 0 && (
            <Etat>
              {nombre(lecture.ignorees)} ligne{lecture.ignorees > 1 ? "s" : ""} ni devis ni facture
            </Etat>
          )}
        </div>
      )}

      {montrerColonnes && (
        <>
          <Rubrique>Colonnes</Rubrique>
          <p className="-mt-[4px] mb-[10px] text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            Atlas hésite sur une colonne. Vérifiez, et changez ce qui ne va pas.
          </p>
          <div className="rounded-[14px] px-[18px] py-[4px]" style={{ backgroundColor: colors.card }} data-atlas="colonnes-tableau">
            {[...reconnaissance.hesite, ...CHAMPS_DU_TABLEAU.filter((c) => !reconnaissance.hesite.includes(c))].map((champ, rang) => (
              <ChoixDeColonne
                key={champ}
                champ={champ}
                premier={rang === 0}
                hesite={reconnaissance.hesite.includes(champ)}
                candidats={reconnaissance.candidats[champ] ?? []}
                entetes={grille[0]}
                valeurs={grille.slice(1)}
                choisie={colonnes[champ] === undefined ? (reconnaissance.colonnes[champ] ?? null) : colonnes[champ]!}
                repondu={colonnes[champ] !== undefined || (champ === "Type" && genreFixe !== null)}
                genreFixe={champ === "Type" ? genreFixe : null}
                choisir={(v) => {
                  if (champ === "Type" && (v === "devis" || v === "facture")) {
                    setGenreFixe(v);
                    setColonnes((c) => ({ ...c, Type: null }));
                  } else {
                    if (champ === "Type") setGenreFixe(null);
                    setColonnes((c) => ({ ...c, [champ]: v === "" ? null : Number(v) }));
                  }
                  // Une autre colonne change les clients lus : les réponses d'avant
                  // ne valent plus (comme sur la planche).
                  setChoix({});
                }}
              />
            ))}
          </div>
          {datesDouteuses && exempleDate && (
            <div className="mt-[12px] rounded-[14px] px-[16px] pb-[2px] pt-[10px]" style={{ backgroundColor: colors.carteAmbreFond }} data-atlas="ordre-des-dates">
              <p className="text-[14.5px] font-semibold leading-[1.4]" style={{ color: colors.carteAmbreTexte }}>
                « {exempleDate} » se lit comment ?
              </p>
              {(["jma", "mja"] as const).map((o, rang) => (
                <Radio
                  key={o}
                  premier={rang === 0}
                  pris={ordreDate === o}
                  titre={dateCitee(jourDuTableau(exempleDate, o)!)}
                  onClick={() => setOrdreDate(o)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {lecture && (
        <div data-atlas="par-client">
          <Rubrique>Par client</Rubrique>
          <div className="rounded-[14px] px-[16px] py-[2px]" style={{ backgroundColor: colors.card }}>
            {[...avecQuestion, ...montres].map((g, rang) => (
              <ClientLu key={g.cle} groupe={g} premier={rang === 0} choisir={(c) => setChoix((x) => ({ ...x, [g.cle]: c }))} />
            ))}
            {sansNom.map((l, rang) => (
              <div key={l.rang} style={{ boxShadow: rang === 0 && avecQuestion.length + montres.length === 0 ? "none" : `inset 0 1px 0 ${colors.line}` }}>
                <EnTeteClient
                  nom="Sans nom"
                  manque
                  lieu={[l.adresse, l.telephone].filter(Boolean).join(", ") || "Sans coordonnées"}
                  etat={<Etat ton="ambre">Nom absent du tableau</Etat>}
                />
                <div className="mb-[8px] ml-[56px]">
                  <PieceLue ligne={l} chantier={l.chantier} />
                </div>
                {/* Taper un nom ne redessine rien : redessinée sous le doigt, la
                    liste bougeait, et l'appui sur « Ranger » se perdait (vu sur
                    la planche, 28 octobre). */}
                <input
                  data-atlas="nom-ligne"
                  value={tapes[l.rang] ?? ""}
                  onChange={(e) => setTapes((x) => ({ ...x, [l.rang]: e.target.value }))}
                  placeholder="Nom du client"
                  aria-label="Nom du client"
                  autoComplete="off"
                  enterKeyHint="done"
                  className="mb-[14px] ml-[56px] block min-h-[48px] w-[calc(100%-56px)] rounded-[6px] px-[13px] py-[11px] text-[16px]"
                  style={{ backgroundColor: colors.cream, color: colors.ink }}
                />
              </div>
            ))}
          </div>
          {autres.length > 0 && (
            <p className="mt-[14px] text-[14.5px]" style={{ color: colors.inkSoft }}>
              Et {nombre(autres.length)} autres clients, {nombre(autres.reduce((t, g) => t + g.lignes.length, 0))} pièces.
            </p>
          )}
          {plan?.ok && plan.aPart > 0 && (
            <p className="mt-[14px] text-[14.5px]" style={{ color: colors.carteAmbreTexte }}>
              {plan.aPart} pièce{plan.aPart > 1 ? "s" : ""} sans adresse d’un nom que vous dites être deux clients : elle{plan.aPart > 1 ? "s ne se rangent" : " ne se range"} pas.
            </p>
          )}
        </div>
      )}

      {envoi.quoi === "refus" && (
        <p role="alert" data-atlas="refus-tableau" className="mt-[18px] text-[15px] leading-[1.55]" style={{ color: colors.alert }}>
          {envoi.raison}
        </p>
      )}

      <button
        type="button"
        onClick={autreFichier}
        className="mt-[18px] min-h-[44px] text-[15px]"
        style={{ color: colors.inkSoft }}
      >
        Choisir un autre fichier
      </button>

      {/* Le geste, sous le pouce, au-dessus de la barre du bas : la liste peut
          faire dix écrans. Il dit ce qui manque tant que rien ne peut se ranger. */}
      <div
        className="atlas-colonne-fixe z-10 px-[26px] pb-3 pt-3"
        style={{ bottom: "var(--atlas-barre)", backgroundColor: colors.cream, boxShadow: `0 -1px 0 ${colors.line}` }}
      >
        <button
          type="button"
          data-atlas="ranger-tableau"
          disabled={!peutRanger}
          onClick={() => void ranger()}
          className="atlas-plein flex min-h-[54px] w-full items-center justify-center rounded-full text-[18px] disabled:opacity-45"
          style={{ backgroundColor: colors.plein, color: colors.cream, fontFamily: font.display }}
        >
          {envoi.quoi === "en-cours" ? "Rangement…" : bouton}
        </button>
      </div>
    </section>
  );
}

function Rubrique({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-[10px] mt-[28px] text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.or }}>
      {children}
    </p>
  );
}

/** Un point ET un mot, jamais la couleur seule. */
function Etat({ ton, children }: { ton?: "vert" | "ambre"; children: React.ReactNode }) {
  const [fond, encre] =
    ton === "vert"
      ? [colors.carteVertFond, colors.carteVertTexte]
      : ton === "ambre"
        ? [colors.carteAmbreFond, colors.carteAmbreTexte]
        : [voile(colors.ink, 0.06), colors.inkSoft];
  return (
    <span
      className="inline-flex min-h-[28px] items-center gap-[7px] whitespace-nowrap rounded-[14px] px-[11px] text-[13.5px] font-semibold leading-none"
      style={{ backgroundColor: fond, color: encre }}
    >
      <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full" style={{ backgroundColor: "currentColor" }} />
      {children}
    </span>
  );
}

function Radio({ pris, titre, sous, premier, onClick }: { pris: boolean; titre: string; sous?: string; premier: boolean; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={pris} onClick={onClick} className="relative flex min-h-[54px] w-full items-start gap-3 py-[10px] text-left">
      {!premier && <span aria-hidden className="absolute left-[34px] right-0 top-0 h-px" style={{ backgroundColor: colors.line }} />}
      <span className="mt-px">
        <CocheRonde pris={pris} />
      </span>
      <span className="min-w-0">
        <span className="block text-[16.5px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
          {titre}
        </span>
        {sous && (
          <span className="mt-0.5 block text-[13.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
            {sous}
          </span>
        )}
      </span>
    </button>
  );
}

function ChoixDeColonne({
  champ,
  premier,
  hesite,
  candidats,
  entetes,
  valeurs,
  choisie,
  repondu,
  genreFixe,
  choisir,
}: {
  champ: ChampDuTableau;
  premier: boolean;
  hesite: boolean;
  /** Les colonnes entre lesquelles Atlas hésite : la question les nomme. */
  candidats: number[];
  entetes: string[];
  valeurs: string[][];
  choisie: number | null;
  repondu: boolean;
  genreFixe: "devis" | "facture" | null;
  choisir: (valeur: string) => void;
}) {
  const enAttente = hesite && !repondu;
  // La première valeur vraiment lue : la première ligne peut être vide.
  const lue = choisie !== null ? valeurs.map((l) => l[choisie] ?? "").find(Boolean) : undefined;
  // « Date 1 ou Date 2 ? Choisissez. », la phrase de la planche.
  const aide = enAttente
    ? candidats.length > 1
      ? `${candidats.map((i) => entetes[i]).join(" ou ")} ? Choisissez.`
      : "À choisir."
    : genreFixe
      ? "Toutes les lignes."
      : choisie !== null
        ? (lue ?? "Vide dans le tableau")
        : null;
  const valeur = genreFixe ?? (choisie === null ? "" : String(choisie));
  return (
    <div className="relative grid grid-cols-[104px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-[10px]">
      {!premier && <span aria-hidden className="absolute left-0 right-0 top-0 h-px" style={{ backgroundColor: colors.line }} />}
      <label
        htmlFor={`colonne-${champ}`}
        className="text-[14.5px]"
        style={{ color: enAttente ? colors.carteAmbreTexte : colors.inkSoft, fontWeight: enAttente ? 700 : 600 }}
      >
        {champ}
      </label>
      <select
        id={`colonne-${champ}`}
        data-atlas={`colonne-${champ}`}
        value={valeur}
        onChange={(e) => choisir(e.target.value)}
        className="min-h-[44px] w-full appearance-none rounded-[10px] border-0 px-3 text-[17px] outline-none"
        style={{
          backgroundColor: colors.cream,
          color: valeur === "" ? colors.inkSoft : colors.ink,
          fontFamily: font.display,
          boxShadow: enAttente ? `inset 0 0 0 2px ${colors.carteAmbreTexte}` : "none",
        }}
      >
        <option value="">{hesite ? "À choisir" : "Pas repris"}</option>
        {champ === "Type" && <option value="devis">Que des devis</option>}
        {champ === "Type" && <option value="facture">Que des factures</option>}
        {entetes.map((e, i) => (
          <option key={i} value={String(i)}>
            {e || `Colonne ${i + 1}`}
          </option>
        ))}
      </select>
      {aide && (
        <small
          // La question passe à la ligne plutôt que de se couper : sur un
          // téléphone de 360, « Choisissez » tombait sous les points.
          className={`col-start-2 pl-3 text-[13.5px] leading-[1.35] ${enAttente ? "" : "truncate"}`}
          style={{ color: enAttente ? colors.carteAmbreTexte : colors.inkSoft, fontWeight: enAttente ? 700 : 400 }}
        >
          {aide}
        </small>
      )}
    </div>
  );
}

function EnTeteClient({ nom, lieu, etat, manque = false }: { nom: string; lieu: string | null; etat: React.ReactNode; manque?: boolean }) {
  return (
    <div className="flex min-h-[64px] items-center gap-3 pb-[6px] pt-[12px]">
      <span
        aria-hidden
        className="grid h-[44px] w-[44px] flex-none place-items-center rounded-full text-[17px]"
        style={{ backgroundColor: colors.rustTint, color: colors.rust, fontFamily: font.display }}
      >
        {manque ? "?" : initiales(nom)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[18.5px] leading-[1.25]" style={{ fontFamily: font.display, color: manque ? colors.inkSoft : colors.ink }}>
          {nom}
        </span>
        {lieu && (
          <span className="mt-[2px] block truncate text-[14px]" style={{ color: colors.inkSoft }}>
            {lieu}
          </span>
        )}
        <span className="mt-[6px] block">{etat}</span>
      </span>
    </div>
  );
}

function ClientLu({ groupe: g, premier, choisir }: { groupe: Groupe; premier: boolean; choisir: (c: ChoixAdresse) => void }) {
  const attend = g.conflit && g.choix === undefined;
  const premiere = g.lignes.find((l) => l.telephone)?.telephone ?? null;
  const etat = attend ? (
    <Etat ton="ambre">Adresse à vérifier</Etat>
  ) : g.deja && g.choix !== "autre" && g.choix !== "deux" ? (
    <Etat>Déjà client, ses pièces s’ajoutent</Etat>
  ) : (
    <Etat ton="vert">{g.choix === "deux" ? `${g.adresses.length} nouveaux clients` : "Nouveau client"}</Etat>
  );
  // L'adresse telle qu'elle apparaît la première fois dans le fichier.
  const lieu = g.conflit ? premiere : [g.adresses[0]?.lieu, premiere].filter(Boolean).join(", ") || null;
  const autres = g.adresses.length > 2 ? "Les autres restent sur ses pièces, comme adresses des chantiers" : "L'autre reste sur ses pièces, comme adresse du chantier";
  return (
    <div data-atlas="client-lu" style={{ boxShadow: premier ? "none" : `inset 0 1px 0 ${colors.line}` }}>
      <EnTeteClient nom={g.nom} lieu={lieu} etat={etat} />
      {g.conflit === "deux" && (
        <div className="mb-[12px] ml-[56px] mt-[2px] rounded-[14px] px-[14px] pb-[2px] pt-[10px]" style={{ backgroundColor: colors.carteAmbreFond }} data-atlas="choix-adresse">
          <p className="text-[14.5px] font-semibold leading-[1.4]" style={{ color: colors.carteAmbreTexte }}>
            {g.adresses.length} adresses pour ce nom. Laquelle est la sienne ?
          </p>
          {g.adresses.map((a, k) => (
            <Radio
              key={a.norme}
              premier={k === 0}
              pris={g.choix === k}
              titre={a.lieu}
              sous={`${a.rangs.length} pièce${a.rangs.length > 1 ? "s" : ""}. ${autres}.`}
              onClick={() => choisir(k)}
            />
          ))}
          <Radio
            premier={false}
            pris={g.choix === "deux"}
            titre={`Ce sont ${g.adresses.length} clients différents`}
            sous="Une fiche par adresse, chacune avec ses pièces."
            onClick={() => choisir("deux")}
          />
        </div>
      )}
      {g.conflit === "fiche" && g.deja && (
        <div className="mb-[12px] ml-[56px] mt-[2px] rounded-[14px] px-[14px] pb-[2px] pt-[10px]" style={{ backgroundColor: colors.carteAmbreFond }} data-atlas="choix-adresse">
          <p className="text-[14.5px] font-semibold leading-[1.4]" style={{ color: colors.carteAmbreTexte }}>
            Sa fiche dit {g.deja.adresse}. Le tableau dit {g.adresses[0].lieu}.
          </p>
          <Radio
            premier
            pris={g.choix === "meme"}
            titre="C'est le même client"
            sous={`Sa fiche garde son adresse. ${g.adresses[0].lieu} reste sur ses pièces, comme adresse du chantier.`}
            onClick={() => choisir("meme")}
          />
          <Radio
            premier={false}
            pris={g.choix === "autre"}
            titre="C'est un autre client"
            sous="Une nouvelle fiche, à l'adresse du tableau."
            onClick={() => choisir("autre")}
          />
        </div>
      )}
      <div className="mb-[12px] ml-[56px]">
        {g.lignes.map((l, rang) => (
          <div key={l.rang} style={{ boxShadow: rang === 0 ? "none" : `inset 0 1px 0 ${colors.lineSoft}` }}>
            <PieceLue ligne={l} chantier={chantierDeLaLigne(g, l)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PieceLue({ ligne: l, chantier }: { ligne: LigneLue; chantier: string | null }) {
  const ref = `${l.genre === "facture" ? "Facture" : "Devis"}${l.numero ? ` n° ${l.numero}` : ""}`;
  const quand = l.jour ? jourCourt(l.jour) : "Sans date";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-[10px] py-[7px]" data-atlas="piece-lue">
      <span className="text-[16px] leading-[1.3]" style={{ fontFamily: font.display, fontVariantNumeric: "lining-nums" }}>
        {l.objet || ref}
      </span>
      {l.montant && (
        <span className="row-span-2 self-center text-[14.5px]" style={{ fontVariantNumeric: "tabular-nums lining-nums" }}>
          {enEuros(l.montant)}
        </span>
      )}
      <span className="col-start-1 text-[13.5px]" style={{ color: colors.inkSoft }}>
        {l.objet ? `${ref}, ${quand}` : quand}
      </span>
      {chantier && (
        <span className="col-start-1 mt-[1px] text-[13.5px]" style={{ color: colors.ink }}>
          Chantier au {chantier}
        </span>
      )}
    </div>
  );
}
