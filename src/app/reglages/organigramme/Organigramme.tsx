"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { colors, font, smallCaps, surPlein, voile } from "@/lib/design-tokens";
import { libelleRole } from "@/lib/acces-roles";
import { MAX_SALARIES } from "@/lib/equipes";
import type { ChefAffiche, CompteOrganigramme, GarsAffiche, Organigramme as Donnees } from "@/lib/organigramme";
import { ajouterSalarieAction, nommerChefAction, rangerSousChefAction } from "./actions";

/**
 * L'organigramme, tel que sa planche du 27 septembre 2026 le dessine : le
 * patron en haut, le bureau, puis le terrain rangé sous ses chefs.
 *
 * **Le patron seul voit les gestes** : toucher un gars ouvre sa fiche (chef
 * d'équipe, ses gars ou son chef), et « Ajouter une personne » en bas. Les
 * autres lisent le même dessin, sans rien de touchable. Le serveur refuse de
 * toute façon (`exigerProprietaire`) : l'écran ne fait que ne pas proposer.
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

  const toucher = (rang: number) => (patron ? () => setOuvert(ouvert === rang ? null : rang) : undefined);

  return (
    <div className="px-5 pt-5">
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
          {chefs.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 pb-5">
              {chefs.map((c) => (
                <CarteChef key={c.rang} chef={c} toucher={toucher} />
              ))}
            </div>
          )}
          {sansChef.length > 0 && (
            <>
              {chefs.length > 0 && <Etage titre="Sans chef" />}
              <div className="flex flex-wrap justify-center gap-3 pb-4">
                {sansChef.map((g) => (
                  <PetitGars key={g.rang} gars={g} toucher={toucher(g.rang)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {patron && typeof ouvert === "number" && terrain.some((g) => g.rang === ouvert) && (
        <FicheGars
          gars={terrain.find((g) => g.rang === ouvert)!}
          estChef={chefs.some((c) => c.rang === ouvert)}
          sesGars={chefs.find((c) => c.rang === ouvert)?.gars ?? []}
          sonChef={chefDe(ouvert)}
          chefs={chefs}
          terrain={terrain}
          enCours={enCours}
          onChef={(v) => agir(() => nommerChefAction(ouvert, v))}
          onRanger={(garsRang, chefRang) => agir(() => rangerSousChefAction(garsRang, chefRang))}
          onFermer={() => setOuvert(null)}
        />
      )}

      {patron && ouvert === "ajout" && (
        <FicheAjout
          chefs={chefs}
          plein={nombreSalaries >= MAX_SALARIES}
          enCours={enCours}
          onSalarie={(nom, chefRang) => agir(() => ajouterSalarieAction(nom, chefRang), true)}
          onCompte={(role) => router.push(`/reglages/equipe/nouveau?role=${role}&retour=organigramme`)}
          onFermer={() => setOuvert(null)}
        />
      )}

      {patron && ouvert !== "ajout" && (
        <button
          type="button"
          onClick={() => setOuvert("ajout")}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-full text-[14px]"
          style={{ border: `1px dashed ${colors.line}`, color: colors.ink }}
        >
          Ajouter une personne
        </button>
      )}

      {message && (
        <p className="mt-3 text-center text-[13px]" style={{ color: colors.alert }} role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

function initiales(texte: string): string {
  const mots = texte.trim().split(/\s+/).filter(Boolean);
  return (mots.length > 1 ? mots[0][0] + mots[1][0] : texte.slice(0, 2)).toUpperCase();
}

function Avatar({ texte, taille = 44 }: { texte: string; taille?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: taille, height: taille, backgroundColor: colors.rustTint, color: colors.rust, fontSize: taille * 0.32 }}
    >
      {initiales(texte)}
    </span>
  );
}

function Etage({ titre }: { titre: string }) {
  return (
    <div className={`mb-1 flex items-center gap-3 ${smallCaps}`} style={{ color: colors.muted }}>
      {titre}
      <span className="h-px flex-1" style={{ backgroundColor: colors.line }} />
    </div>
  );
}

function Rangee({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-center gap-2.5 pb-5 pt-2.5">{children}</div>;
}

function CarteCompte({ compte, moi, haut = false }: { compte: CompteOrganigramme; moi: string; haut?: boolean }) {
  const nom = compte.utilisateurId === moi ? "Vous" : compte.nom;
  return (
    <div
      className="flex min-w-0 max-w-[190px] flex-1 flex-col items-center rounded-2xl px-2 py-3 text-center"
      style={{ backgroundColor: haut ? colors.rustTint : colors.card, border: `1px solid ${colors.lineSoft}` }}
    >
      <Avatar texte={compte.nom ?? libelleRole(compte.role)} />
      {nom && (
        <span className="mt-1.5 block max-w-full truncate text-[16px]" style={{ fontFamily: font.display }}>
          {nom}
        </span>
      )}
      <span className="mt-0.5 block text-[9.5px] uppercase tracking-[0.22em]" style={{ color: colors.or }}>
        {libelleRole(compte.role)}
      </span>
    </div>
  );
}

function CarteChef({ chef, toucher }: { chef: ChefAffiche; toucher: (rang: number) => (() => void) | undefined }) {
  const surChef = toucher(chef.rang);
  return (
    <div className="rounded-2xl px-2 pb-2 pt-3 text-center" style={{ border: `1px solid ${colors.lineSoft}` }}>
      <Touchable onClick={surChef} className="flex w-full flex-col items-center">
        <Avatar texte={chef.libelle} />
        <span className="mt-1.5 block max-w-full truncate text-[16px]" style={{ fontFamily: font.display }}>
          {chef.libelle}
        </span>
        <span className="block text-[9.5px] uppercase tracking-[0.22em]" style={{ color: colors.or }}>
          Chef d&apos;équipe
        </span>
      </Touchable>
      {chef.gars.length > 0 && (
        <div className="mt-2.5 flex flex-wrap justify-center gap-2.5 pt-2.5" style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
          {chef.gars.map((g) => (
            <PetitGars key={g.rang} gars={g} toucher={toucher(g.rang)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PetitGars({ gars, toucher }: { gars: GarsAffiche; toucher: (() => void) | undefined }) {
  return (
    <Touchable onClick={toucher} className="flex w-[64px] flex-col items-center text-[13px]">
      <Avatar texte={gars.libelle} taille={38} />
      <span className="mt-1 block max-w-full truncate">{gars.libelle}</span>
    </Touchable>
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

function Feuille({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: React.ReactNode }) {
  // La fiche s'ouvre sous l'organigramme : sans ce défilement, toucher un gars
  // en haut de l'écran n'aurait rien changé de ce qu'il voit.
  const ici = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ici.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [titre]);
  return (
    <div ref={ici} className="mt-4 rounded-2xl px-5 pb-5 pt-4" style={{ backgroundColor: colors.card, border: `1px solid ${colors.lineSoft}` }}>
      <div className="flex items-center justify-between">
        <span className="text-[22px]" style={{ fontFamily: font.display }}>
          {titre}
        </span>
        <button type="button" onClick={onFermer} className="min-h-[40px] px-2 text-[13px]" style={{ color: colors.muted }}>
          Fermer
        </button>
      </div>
      {children}
    </div>
  );
}

function Pastille({ choisie, onClick, children, inerte }: { choisie: boolean; onClick: () => void; children: React.ReactNode; inerte: boolean }) {
  return (
    <button
      type="button"
      disabled={inerte}
      onClick={onClick}
      className="inline-flex min-h-[40px] items-center rounded-full px-4 text-[13px]"
      style={{
        backgroundColor: choisie ? colors.rustTint : "transparent",
        border: `1px solid ${choisie ? "transparent" : colors.line}`,
        color: choisie ? colors.ink : colors.muted,
        fontWeight: choisie ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}

function Interrupteur({ allume, onClick, inerte, libelle }: { allume: boolean; onClick: () => void; inerte: boolean; libelle: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={allume}
      aria-label={libelle}
      disabled={inerte}
      onClick={onClick}
      className="relative h-7 w-[46px] shrink-0 rounded-full"
      style={{ backgroundColor: allume ? colors.rust : colors.line }}
    >
      <span
        className="absolute top-[3px] h-[22px] w-[22px] rounded-full"
        style={{ backgroundColor: surPlein, left: allume ? 21 : 3, boxShadow: `0 1px 2px ${voile(colors.ink, 0.2)}` }}
      />
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
  onChef: (v: boolean) => void;
  onRanger: (garsRang: number, chefRang: number | null) => void;
  onFermer: () => void;
}) {
  const autresChefs = chefs.filter((c) => c.rang !== gars.rang);
  // Ceux qu'il peut prendre sous lui : tous ceux du terrain qui ne sont pas chefs.
  const prenables = terrain.filter((g) => g.rang !== gars.rang && !chefs.some((c) => c.rang === g.rang));
  return (
    <Feuille titre={gars.libelle} onFermer={onFermer}>
      <div className="mt-3 flex items-center justify-between py-3" style={{ borderTop: `1px solid ${colors.line}` }}>
        <span className="text-[15px]">Chef d&apos;équipe</span>
        <Interrupteur allume={estChef} inerte={enCours} libelle="Chef d'équipe" onClick={() => onChef(!estChef)} />
      </div>
      {estChef ? (
        prenables.length > 0 && (
          <div className="pb-1">
            {prenables.map((g) => {
              const sousLui = sesGars.some((s) => s.rang === g.rang);
              return (
                <label key={g.rang} className="flex min-h-[44px] items-center gap-3 text-[15px]">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    style={{ accentColor: colors.rust }}
                    checked={sousLui}
                    disabled={enCours}
                    onChange={() => onRanger(g.rang, sousLui ? null : gars.rang)}
                  />
                  {g.libelle}
                </label>
              );
            })}
          </div>
        )
      ) : (
        autresChefs.length > 0 && (
          <div className="pb-1" style={{ borderTop: `1px solid ${colors.line}` }}>
            <span className={`mb-2 mt-3 block ${smallCaps}`} style={{ color: colors.muted }}>
              Son chef
            </span>
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
          </div>
        )
      )}
    </Feuille>
  );
}

type RoleAjout = "salarie" | "commercial" | "facturation";

function FicheAjout({
  chefs,
  plein,
  enCours,
  onSalarie,
  onCompte,
  onFermer,
}: {
  chefs: ChefAffiche[];
  plein: boolean;
  enCours: boolean;
  onSalarie: (nom: string, chefRang: number | null) => void;
  onCompte: (role: "commercial" | "facturation") => void;
  onFermer: () => void;
}) {
  const [role, setRole] = useState<RoleAjout>("salarie");
  const [nom, setNom] = useState("");
  const [chefRang, setChefRang] = useState<number | null>(null);
  return (
    <Feuille titre="Nouvelle personne" onFermer={onFermer}>
      <span className={`mb-2 mt-3 block ${smallCaps}`} style={{ color: colors.muted }}>
        C&apos;est
      </span>
      <div className="flex flex-wrap gap-2">
        <Pastille choisie={role === "salarie"} inerte={enCours} onClick={() => setRole("salarie")}>
          Un salarié
        </Pastille>
        <Pastille choisie={role === "commercial"} inerte={enCours} onClick={() => setRole("commercial")}>
          Un commercial
        </Pastille>
        <Pastille choisie={role === "facturation"} inerte={enCours} onClick={() => setRole("facturation")}>
          La facturation
        </Pastille>
      </div>

      {role === "salarie" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSalarie(nom, chefRang);
          }}
        >
          <label className="block pt-4">
            <span className="mb-1 block text-[11px]" style={{ color: colors.muted }}>
              Prénom
            </span>
            <input
              className="w-full bg-transparent py-2 text-[17px] outline-none"
              style={{ borderBottom: `1px solid ${colors.line}`, color: colors.ink }}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              autoComplete="off"
            />
          </label>
          {chefs.length > 0 && (
            <>
              <span className={`mb-2 mt-4 block ${smallCaps}`} style={{ color: colors.muted }}>
                Son chef
              </span>
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
            <p className="mt-4 text-[13px]" style={{ color: colors.muted }}>
              Vingt personnes au plus sur le terrain.
            </p>
          ) : (
            <button
              type="submit"
              disabled={enCours || !nom.trim()}
              className="atlas-plein mt-5 flex w-full items-center justify-center rounded-full py-3.5 text-[14px] font-semibold"
              style={{ backgroundColor: colors.plein, color: surPlein, opacity: enCours || !nom.trim() ? 0.6 : 1 }}
            >
              {nom.trim() ? `Ajouter ${nom.trim()}` : "Ajouter"}
            </button>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => onCompte(role)}
          className="atlas-plein mt-5 flex w-full items-center justify-center rounded-full py-3.5 text-[14px] font-semibold"
          style={{ backgroundColor: colors.plein, color: surPlein }}
        >
          Créer son compte
        </button>
      )}
    </Feuille>
  );
}
