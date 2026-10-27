"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { libelleRole } from "@/lib/acces-roles";
import { MAX_SALARIES } from "@/lib/equipes";
import type { ChefAffiche, CompteOrganigramme, GarsAffiche, Organigramme as Donnees } from "@/lib/organigramme";
import BottomSheet from "@/components/atlas/BottomSheet";
import TeteRonde from "@/components/atlas/TeteRonde";
import ActionBas from "@/components/atlas/reglages/ActionBas";
import CocheRonde from "@/components/atlas/reglages/CocheRonde";
import LigneReglage, { styleValeurReglage } from "@/components/atlas/reglages/LigneReglage";
import Picto from "@/components/atlas/reglages/Picto";
import { ajouterSalarieAction, nommerChefAction, rangerSousChefAction } from "./actions";

/**
 * L'organigramme, tel que sa planche du 27 septembre 2026 le dessine : le
 * patron en haut, le bureau, puis le terrain rangé sous ses chefs.
 *
 * **Le patron seul voit les gestes** : toucher un gars ouvre sa fiche (chef
 * d'équipe, ses gars ou son chef), et « Ajouter une personne » en bas. Les
 * autres lisent le même dessin, sans rien de touchable. Le serveur refuse de
 * toute façon (`exigerProprietaire`) : l'écran ne fait que ne pas proposer.
 *
 * **Sa planche du 26 octobre 2026** (`appli/soignee/reglages-organigramme.html`) :
 * l'arbre se lit de haut en bas, relié d'un trait d'or ; les rôles s'écrivent
 * en toutes lettres et en or ; le chef porte ses gars dans SA plage ; toucher
 * quelqu'un ouvre une feuille qui monte, au lieu d'une carte posée sous
 * l'arbre ; « Ajouter une personne » devient le bouton plein, au-dessus de la
 * barre.
 */
export default function Organigramme({
  organigramme,
  moi,
  patron,
  nombreSalaries,
}: {
  organigramme: Donnees;
  moi: string;
  patron: boolean;
  nombreSalaries: number;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState<number | "ajout" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const { patrons, bureau, chefs, sansChef } = organigramme;
  const terrain: GarsAffiche[] = [...chefs, ...chefs.flatMap((c) => c.gars), ...sansChef];
  const chefDe = (rang: number) => chefs.find((c) => c.gars.some((g) => g.rang === rang)) ?? null;

  function agir(geste: () => Promise<{ ok: true } | { ok: false; message: string }>, fermer = false) {
    setMessage(null);
    demarrer(async () => {
      const r = await geste();
      if (!r.ok) setMessage(r.message);
      else {
        if (fermer) setOuvert(null);
        router.refresh();
      }
    });
  }

  // Une feuille refermée emporte son refus : il ne doit pas ressurgir dans la suivante.
  const fermer = () => {
    setOuvert(null);
    setMessage(null);
  };

  const toucher = (rang: number) => (patron ? () => setOuvert(rang) : undefined);
  const garsOuvert = typeof ouvert === "number" ? terrain.find((g) => g.rang === ouvert) : undefined;
  const refus = message && (
    <p className="mt-3 text-center text-[14px]" style={{ color: colors.alert }} role="alert">
      {message}
    </p>
  );

  return (
    <div className="px-[22px] pt-6">
      <Rangee>
        {patrons.map((p) => (
          <CarteCompte key={p.membreId} compte={p} moi={moi} haut />
        ))}
      </Rangee>

      {bureau.length > 0 && (
        <>
          <Etage titre="Bureau" />
          <Rangee>
            {bureau.map((p) => (
              <CarteCompte key={p.membreId} compte={p} moi={moi} />
            ))}
          </Rangee>
        </>
      )}

      {terrain.length > 0 && (
        <>
          <Etage titre="Terrain" />
          {/* **Le chef porte ses gars dans SA plage, en pleine largeur** : on
              voit d'un coup qui travaille avec qui. */}
          {chefs.map((c) => (
            <PlageChef key={c.rang} chef={c} toucher={toucher} />
          ))}
          {sansChef.length > 0 && (
            <>
              {/* « Sans chef » ne s'écrit que s'il y a au moins un chef : sans
                  chef du tout, c'est tout le terrain, et le titre « Terrain »
                  le dit déjà. */}
              {chefs.length > 0 && (
                <p className="mb-2.5 mt-[22px] text-center text-[13px] font-semibold uppercase" style={{ color: colors.or, letterSpacing: "0.12em" }}>
                  Sans chef
                </p>
              )}
              <div className="rounded-[6px] px-2.5 py-3" style={{ backgroundColor: colors.card }}>
                <Gars gars={sansChef} toucher={toucher} />
              </div>
            </>
          )}
        </>
      )}

      {patron && garsOuvert && (
        <FicheGars
          gars={garsOuvert}
          estChef={chefs.some((c) => c.rang === garsOuvert.rang)}
          sesGars={chefs.find((c) => c.rang === garsOuvert.rang)?.gars ?? []}
          sonChef={chefDe(garsOuvert.rang)}
          chefs={chefs}
          terrain={terrain}
          enCours={enCours}
          refus={refus}
          onChef={(v) => agir(() => nommerChefAction(garsOuvert.rang, v))}
          onRanger={(garsRang, chefRang) => agir(() => rangerSousChefAction(garsRang, chefRang))}
          onFermer={fermer}
        />
      )}

      {/* Montée seulement ouverte : chaque « Ajouter une personne » repart
          d'une feuille vide, sans le prénom de la fois d'avant. */}
      {patron && ouvert === "ajout" && (
        <FicheAjout
          chefs={chefs}
          plein={nombreSalaries >= MAX_SALARIES}
          enCours={enCours}
          refus={refus}
          onSalarie={(nom, chefRang) => agir(() => ajouterSalarieAction(nom, chefRang), true)}
          onCompte={(role) => router.push(`/reglages/equipe/nouveau?role=${role}&retour=organigramme`)}
          onFermer={fermer}
        />
      )}

      {/* **Le seul bouton plein**, au-dessus de la barre (planche du 26 octobre
          2026). Chez un salarié, rien : il lit, il ne change rien. */}
      {patron && (
        <ActionBas>
          <button
            type="button"
            onClick={() => setOuvert("ajout")}
            className="atlas-plein flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full text-[17px] font-semibold"
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            <Picto nom="plus" />
            Ajouter une personne
          </button>
        </ActionBas>
      )}
    </div>
  );
}

function initiales(texte: string): string {
  const mots = texte.trim().split(/\s+/).filter(Boolean);
  return (mots.length > 1 ? mots[0][0] + mots[1][0] : texte.slice(0, 2)).toUpperCase();
}

function Avatar({ texte, photo, taille }: { texte: string; photo: string | null; taille: number }) {
  // La même tête qu'au planning et dans Équipe (`TeteRonde`) : un seul dessin.
  return <TeteRonde repli={initiales(texte)} photo={photo} taille={taille} />;
}

/** Le trait d'or qui relie deux étages : l'arbre se lit de haut en bas. */
function Lien({ court = false }: { court?: boolean }) {
  return (
    <span
      aria-hidden
      className={`mx-auto block w-[2px] rounded-[1px] ${court ? "mb-1.5 h-3" : "h-[22px]"}`}
      style={{ backgroundColor: voile(colors.or, 0.55) }}
    />
  );
}

// Le mot seul, sans filet qui le prolonge : il les a fait retirer le 25 août
// 2026 (`test-accueil-en-tete.ts`). Le trait d'or, lui, est vertical : il
// relie, il ne souligne pas.
function Etage({ titre }: { titre: string }) {
  return (
    <>
      <Lien />
      <p
        className="my-1.5 text-center text-[13px] font-semibold uppercase"
        style={{ color: colors.or, letterSpacing: "0.12em" }}
      >
        {titre}
      </p>
      <Lien court />
    </>
  );
}

function Rangee({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-center gap-2.5">{children}</div>;
}

/** Une personne du haut ou du bureau : sa tête, son nom en gras, son rôle en or et en toutes lettres. */
function CarteCompte({ compte, moi, haut = false }: { compte: CompteOrganigramme; moi: string; haut?: boolean }) {
  const nom = compte.utilisateurId === moi ? "Vous" : compte.nom;
  return (
    <div
      className="flex min-w-0 max-w-[180px] flex-1 flex-col items-center gap-[3px] rounded-[6px] px-2.5 pb-3.5 pt-4 text-center"
      style={{ backgroundColor: haut ? colors.rustTint : colors.card }}
    >
      <span className="mb-1.5">
        <Avatar texte={compte.nom ?? libelleRole(compte.role)} photo={compte.photo} taille={haut ? 56 : 52} />
      </span>
      {nom && (
        <span
          className="block max-w-full truncate text-[19px] font-semibold leading-[1.2]"
          style={{ fontFamily: font.display, color: colors.ink }}
        >
          {nom}
        </span>
      )}
      <span className="block text-[14px] font-semibold" style={{ color: colors.or }}>
        {libelleRole(compte.role)}
      </span>
    </div>
  );
}

function PlageChef({ chef, toucher }: { chef: ChefAffiche; toucher: (rang: number) => (() => void) | undefined }) {
  const surChef = toucher(chef.rang);
  return (
    <div className="mb-2.5 rounded-[6px] p-[18px]" style={{ backgroundColor: colors.card }}>
      <Touchable onClick={surChef} className="flex min-h-[60px] w-full items-center gap-3.5 text-left">
        <Avatar texte={chef.libelle} photo={chef.photo} taille={52} />
        <span className="min-w-0 flex-1">
          <span
            className="block max-w-full truncate text-[19px] font-semibold leading-[1.2]"
            style={{ fontFamily: font.display, color: colors.ink }}
          >
            {chef.libelle}
          </span>
          <span className="block text-[14px] font-semibold" style={{ color: colors.or }}>
            Chef d&apos;équipe
          </span>
        </span>
        {surChef && (
          <span className="flex-none" style={{ color: colors.or }}>
            <Picto nom="suivant" taille={20} epaisseur={2} />
          </span>
        )}
      </Touchable>
      {chef.gars.length > 0 && (
        <div className="mt-3.5 pt-3.5" style={{ boxShadow: `inset 0 1px 0 ${colors.line}` }}>
          <Gars gars={chef.gars} toucher={toucher} />
        </div>
      )}
    </div>
  );
}

function Gars({ gars, toucher }: { gars: GarsAffiche[]; toucher: (rang: number) => (() => void) | undefined }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-1 gap-y-1.5">
      {gars.map((g) => (
        <Touchable key={g.rang} onClick={toucher(g.rang)} className="flex w-[76px] flex-col items-center gap-1.5 px-0.5 py-1.5">
          <Avatar texte={g.libelle} photo={g.photo} taille={46} />
          <span className="block max-w-full truncate text-[15px]" style={{ color: colors.ink }}>
            {g.libelle}
          </span>
        </Touchable>
      ))}
    </div>
  );
}

/** Un bouton pour le patron, un simple bloc pour les autres : rien ne se touche pour rien. */
function Touchable({ onClick, className, children }: { onClick: (() => void) | undefined; className: string; children: React.ReactNode }) {
  if (!onClick) return <div className={className}>{children}</div>;
  return (
    <button type="button" onClick={onClick} className={className} style={{ color: colors.ink }}>
      {children}
    </button>
  );
}

/** Le petit libellé d'une partie de la feuille, en toutes lettres. */
function SousTitre({ children, premier = false }: { children: React.ReactNode; premier?: boolean }) {
  return (
    <p className={`mb-2.5 text-[14px] font-semibold ${premier ? "" : "mt-[18px]"}`} style={{ color: colors.inkSoft }}>
      {children}
    </p>
  );
}

function Pastille({ choisie, onClick, children, inerte }: { choisie: boolean; onClick: () => void; children: React.ReactNode; inerte: boolean }) {
  return (
    <button
      type="button"
      disabled={inerte}
      onClick={onClick}
      aria-pressed={choisie}
      className="min-h-[44px] rounded-full px-4 text-[15px] font-semibold"
      style={
        choisie
          ? { backgroundColor: colors.rustTint, color: colors.ink, boxShadow: `inset 0 0 0 2px ${colors.rust}` }
          : { color: colors.inkSoft, boxShadow: `inset 0 0 0 1px ${colors.line}` }
      }
    >
      {children}
    </button>
  );
}

/** L'interrupteur « Chef d'équipe » : un état, pas un bouton ; allumé, il prend le vert des bascules. */
function Interrupteur({ allume, onClick, inerte, libelle }: { allume: boolean; onClick: () => void; inerte: boolean; libelle: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={allume}
      aria-label={libelle}
      disabled={inerte}
      onClick={onClick}
      className="relative h-8 w-[52px] shrink-0 rounded-full"
      style={{ backgroundColor: allume ? colors.plein : voile(colors.ink, 0.18), transition: "background-color .22s" }}
    >
      <span
        className="absolute top-[3px] h-[26px] w-[26px] rounded-full"
        style={{
          backgroundColor: colors.card,
          left: allume ? 23 : 3,
          boxShadow: `0 1px 2px ${voile(colors.ink, 0.2)}`,
          transition: "left .24s cubic-bezier(.34,1.4,.5,1)",
        }}
      />
    </button>
  );
}

/** Le bouton « Fermer » d'une feuille : en mots, sous le reste. */
function Fermer({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-full text-[16px] font-semibold"
      style={{ color: colors.inkSoft }}
    >
      Fermer
    </button>
  );
}

function FicheGars({
  gars,
  estChef,
  sesGars,
  sonChef,
  chefs,
  terrain,
  enCours,
  refus,
  onChef,
  onRanger,
  onFermer,
}: {
  gars: GarsAffiche;
  estChef: boolean;
  sesGars: GarsAffiche[];
  sonChef: ChefAffiche | null;
  chefs: ChefAffiche[];
  terrain: GarsAffiche[];
  enCours: boolean;
  refus: React.ReactNode;
  onChef: (v: boolean) => void;
  onRanger: (garsRang: number, chefRang: number | null) => void;
  onFermer: () => void;
}) {
  const autresChefs = chefs.filter((c) => c.rang !== gars.rang);
  // Ceux qu'il peut prendre sous lui : tous ceux du terrain qui ne sont pas chefs.
  const prenables = terrain.filter((g) => g.rang !== gars.rang && !chefs.some((c) => c.rang === g.rang));
  return (
    <BottomSheet open onBackdropClick={onFermer}>
      <div className="mb-3.5 mt-1.5 flex items-center gap-3.5">
        <Avatar texte={gars.libelle} photo={gars.photo} taille={52} />
        <p className="min-w-0 truncate text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
          {gars.libelle}
        </p>
      </div>
      <div className="flex min-h-[64px] items-center gap-3.5 rounded-[6px] px-[18px] py-3" style={{ backgroundColor: colors.card }}>
        <span className="min-w-0 flex-1 text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
          Chef d&apos;équipe
        </span>
        <Interrupteur allume={estChef} inerte={enCours} libelle="Chef d'équipe" onClick={() => onChef(!estChef)} />
      </div>
      {estChef ? (
        prenables.length > 0 && (
          <>
            <SousTitre>Ses gars</SousTitre>
            {/* **Des cases dorées à la taille du doigt** (planche du 26 octobre
                2026) : la case native de 20 px se visait. */}
            <div className="rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
              {prenables.map((g, i) => {
                const sousLui = sesGars.some((s) => s.rang === g.rang);
                return (
                  <button
                    key={g.rang}
                    type="button"
                    role="checkbox"
                    aria-checked={sousLui}
                    disabled={enCours}
                    onClick={() => onRanger(g.rang, sousLui ? null : gars.rang)}
                    className="relative flex min-h-[56px] w-full items-center gap-3.5 text-left text-[18px] leading-[1.25]"
                    style={{ fontFamily: font.display, color: colors.ink }}
                  >
                    {i > 0 && (
                      <span aria-hidden className="absolute left-[38px] right-0 top-0 h-px" style={{ backgroundColor: colors.line }} />
                    )}
                    <span
                      aria-hidden
                      className="flex h-6 w-6 flex-none items-center justify-center rounded-[6px]"
                      style={
                        sousLui
                          ? { backgroundColor: colors.or, color: surPlein }
                          : { boxShadow: `inset 0 0 0 1.5px ${colors.chevron}`, color: "transparent" }
                      }
                    >
                      <Picto nom="coche" taille={18} epaisseur={2.6} />
                    </span>
                    {g.libelle}
                  </button>
                );
              })}
            </div>
          </>
        )
      ) : (
        autresChefs.length > 0 && (
          <>
            <SousTitre>Son chef</SousTitre>
            <div className="flex flex-wrap gap-2">
              {autresChefs.map((c) => (
                <Pastille key={c.rang} choisie={sonChef?.rang === c.rang} inerte={enCours} onClick={() => onRanger(gars.rang, c.rang)}>
                  {c.libelle}
                </Pastille>
              ))}
              <Pastille choisie={sonChef === null} inerte={enCours} onClick={() => onRanger(gars.rang, null)}>
                Aucun
              </Pastille>
            </div>
          </>
        )
      )}
      {refus}
      <Fermer onClick={onFermer} />
    </BottomSheet>
  );
}

type RoleAjout = "salarie" | "commercial" | "facturation";

const ROLES_AJOUT: { role: RoleAjout; mot: string }[] = [
  { role: "salarie", mot: "Un salarié" },
  { role: "commercial", mot: "Un commercial" },
  { role: "facturation", mot: "La facturation" },
];

function FicheAjout({
  chefs,
  plein,
  enCours,
  refus,
  onSalarie,
  onCompte,
  onFermer,
}: {
  chefs: ChefAffiche[];
  plein: boolean;
  enCours: boolean;
  refus: React.ReactNode;
  onSalarie: (nom: string, chefRang: number | null) => void;
  onCompte: (role: "commercial" | "facturation") => void;
  onFermer: () => void;
}) {
  const [role, setRole] = useState<RoleAjout>("salarie");
  const [nom, setNom] = useState("");
  const [chefRang, setChefRang] = useState<number | null>(null);
  const pret = !enCours && nom.trim() !== "";
  return (
    <BottomSheet open onBackdropClick={onFermer}>
      <p className="mb-4 mt-1.5 text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
        Nouvelle personne
      </p>
      <SousTitre premier>C&apos;est</SousTitre>
      <div className="rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
        {ROLES_AJOUT.map(({ role: r, mot }, i) => (
          <button
            key={r}
            type="button"
            disabled={enCours}
            aria-pressed={role === r}
            onClick={() => setRole(r)}
            className="relative flex min-h-[60px] w-full items-center gap-3 text-left text-[17.5px] leading-[1.25]"
            style={{ fontFamily: font.display, color: colors.ink }}
          >
            {i > 0 && <span aria-hidden className="absolute left-[34px] right-0 top-0 h-px" style={{ backgroundColor: colors.line }} />}
            <CocheRonde pris={role === r} />
            {mot}
          </button>
        ))}
      </div>

      {role === "salarie" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSalarie(nom, chefRang);
          }}
        >
          <div className="mt-4 overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
            <LigneReglage libelle="Prénom" htmlFor="organigramme-prenom">
              <input
                id="organigramme-prenom"
                style={styleValeurReglage}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Son prénom"
                autoComplete="off"
              />
            </LigneReglage>
          </div>
          {chefs.length > 0 && (
            <>
              <SousTitre>Son chef</SousTitre>
              <div className="flex flex-wrap gap-2">
                {chefs.map((c) => (
                  <Pastille key={c.rang} choisie={chefRang === c.rang} inerte={enCours} onClick={() => setChefRang(c.rang)}>
                    {c.libelle}
                  </Pastille>
                ))}
                <Pastille choisie={chefRang === null} inerte={enCours} onClick={() => setChefRang(null)}>
                  Aucun
                </Pastille>
              </div>
            </>
          )}
          {plein ? (
            <p className="mx-0.5 mt-3.5 text-[14.5px]" style={{ color: colors.inkSoft }}>
              Vingt personnes au plus sur le terrain.
            </p>
          ) : (
            <button
              type="submit"
              disabled={!pret}
              className="atlas-plein mt-6 flex min-h-[56px] w-full items-center justify-center rounded-full text-[17px] font-semibold"
              style={{ backgroundColor: colors.plein, color: surPlein, opacity: pret ? 1 : 0.4 }}
            >
              {nom.trim() ? `Ajouter ${nom.trim()}` : "Ajouter"}
            </button>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => onCompte(role)}
          className="atlas-plein mt-6 flex min-h-[56px] w-full items-center justify-center rounded-full text-[17px] font-semibold"
          style={{ backgroundColor: colors.plein, color: surPlein }}
        >
          Créer son compte
        </button>
      )}
      {refus}
      <Fermer onClick={onFermer} />
    </BottomSheet>
  );
}
