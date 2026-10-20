"use client";

import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import { CATEGORIES, piecesVisibles, type Choix } from "@/lib/arrosage/choix-de-pieces";
import { photoDe } from "@/lib/arrosage/photos";
import type { PieceChoisie } from "@/lib/arrosage/retouches";

/**
 * LES DEUX FEUILLES QUI MONTENT DU BAS — le menu d'une pièce, et le choix d'une
 * pièce dans le catalogue. Celles de la planche validée le 18 octobre 2026.
 *
 * **Le menu dit ce qu'on peut faire de CETTE pièce** : changer, supprimer,
 * remettre, revenir à la pièce proposée. Quand la pièce est en plusieurs
 * exemplaires, « la A » : un bandeau déroulant « Combien », qui part sur toutes,
 * puis le geste, dont le libellé suit le nombre (*« on ne va pas à chaque fois
 * faire une par une »*).
 *
 * **Le choix parcourt le catalogue, mot pour mot**, par catégorie ou par mot
 * cherché. La référence s'écrit quand elle a été relevée, sinon « Réf. du
 * fournisseur » : rien ne s'invente.
 */

export type Geste = { libelle: string; danger?: boolean; agir: (n: number) => void };

export type Menu = {
  titre: string;
  /** La pièce qu'on avait proposée, quand il l'a changée. */
  proposee: string | null;
  /** Combien de pièces le menu peut toucher ; au-delà d'une, le bandeau « Combien » se montre. */
  nombre: number;
  gestes: Geste[];
};

export function MenuPiece({ menu, onFermer }: { menu: Menu; onFermer: () => void }) {
  const [n, setN] = useState(menu.nombre);
  const mot = (libelle: string) => `${libelle}${menu.nombre > 1 ? (n === menu.nombre ? ` les ${n}` : n === 1 ? " une seule" : ` ${n}`) : ""}`;
  return (
    <Feuille titre={menu.titre} onFermer={onFermer} repere="menu-piece">
      {menu.proposee && (
        <p className="mt-[6px] text-[13px]" style={{ color: colors.muted }}>
          Proposée : {menu.proposee}
        </p>
      )}
      <div className="mt-[14px] flex flex-col gap-2">
        {menu.nombre > 1 && (
          <label className="flex min-h-[52px] items-center gap-3 rounded-[12px] px-[14px]" style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.card }}>
            <span className="flex-1 text-[15.5px]">Combien</span>
            <select
              aria-label="Combien de pièces"
              data-atlas="combien"
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="appearance-none rounded-[10px] border-0 py-2 pl-[14px] pr-[34px] text-[17px] font-semibold"
              style={{
                minWidth: 110, minHeight: 40, color: colors.ink, backgroundColor: colors.cream, boxShadow: `0 0 0 1px ${colors.line}`,
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='9' viewBox='0 0 14 9'%3E%3Cpath d='M1 1l6 6 6-6' fill='none' stroke='%231c1c1a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
              }}
            >
              {Array.from({ length: menu.nombre }, (_, i) => menu.nombre - i).map((k) => (
                <option key={k} value={k}>
                  {k === menu.nombre ? `toutes les ${k}` : k === 1 ? "une seule" : k}
                </option>
              ))}
            </select>
          </label>
        )}
        {menu.gestes.map((g) => (
          <button
            key={g.libelle}
            type="button"
            data-atlas="geste"
            onClick={() => { g.agir(n); onFermer(); }}
            className="min-h-[52px] rounded-full text-[15.5px]"
            style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.card, color: g.danger ? colors.alert : colors.ink }}
          >
            {g.libelle.startsWith("Changer") || g.libelle.startsWith("Supprimer") ? mot(g.libelle.split(" ")[0]) : g.libelle}
          </button>
        ))}
      </div>
    </Feuille>
  );
}

export function ChoisirUnePiece({
  titre,
  categorie: categorieDepart,
  onChoix,
  onFermer,
}: {
  titre: "Changer la pièce" | "Ajouter une pièce";
  categorie: string;
  onChoix: (piece: PieceChoisie) => void;
  onFermer: () => void;
}) {
  const [categorie, setCategorie] = useState(categorieDepart);
  const [recherche, setRecherche] = useState("");
  const vues: Choix[] = piecesVisibles(categorie, recherche);
  return (
    <Feuille titre={titre} onFermer={onFermer} repere="choisir-piece">
      {/* 16 px au moins : en dessous, iOS agrandit la page à la mise au point. */}
      <input
        type="search"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Chercher une pièce"
        aria-label="Chercher une pièce"
        className="mt-3 block w-full rounded-[10px] border-0 px-3 py-3 text-[16px]"
        style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
      />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map(([cle, libelle]) => {
          const active = !recherche && categorie === cle;
          return (
            <button
              key={cle}
              type="button"
              aria-pressed={active}
              onClick={() => { setCategorie(cle); setRecherche(""); }}
              className="rounded-full px-3 py-2 text-[13.5px]"
              style={{ border: `1px solid ${active ? colors.ink : colors.line}`, backgroundColor: active ? colors.ink : colors.card, color: active ? colors.card : colors.ink }}
            >
              {libelle}
            </button>
          );
        })}
      </div>
      <div>
        {vues.map((x) => {
          const photo = photoDe(x.ref);
          return (
            <button
              key={x.ref}
              type="button"
              data-atlas="choix-piece"
              data-ref={x.ref}
              onClick={() => onChoix({ ref: x.ref, nom: x.nom })}
              className="mt-2 flex w-full items-center gap-3 rounded-full border-0 px-3 py-[10px] text-left text-[14px]"
              style={{ backgroundColor: colors.card, color: colors.ink }}
            >
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[8px]" style={photo ? undefined : { border: `1.5px dashed ${colors.line}` }}>
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element -- pansement assumé : next/image n’a rien à optimiser sur une photo de pièce servie telle quelle depuis public/, une photo de pièce, servie telle quelle
                  <img src={photo} alt="" style={{ maxWidth: 44, maxHeight: 44, objectFit: "contain" }} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                {x.nom}
                <small className="block text-[12px]" style={{ color: colors.muted }}>
                  {x.sansReference ? "Réf. du fournisseur" : x.ref}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </Feuille>
  );
}

/** Le message au fournisseur : il le lit, le copie, ou l'envoie par le partage du téléphone. */
export function FeuilleFournisseur({ message, onFermer }: { message: string; onFermer: () => void }) {
  const [texte, setTexte] = useState(message);
  const [copie, setCopie] = useState<"Copier" | "Copié" | "Sélectionné">("Copier");
  const peutPartager = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <Feuille titre="Au fournisseur" onFermer={onFermer} repere="fournisseur">
      <p className="mt-[6px] text-[13px]" style={{ color: colors.muted }}>
        Tout est additionné, sans prix. Vous pouvez modifier le texte.
      </p>
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        aria-label="Le message au fournisseur"
        data-atlas="message-fournisseur"
        className="mt-3 block min-h-[300px] w-full resize-y rounded-[12px] border-0 p-3 text-[16px] leading-[1.5]"
        style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(texte).then(() => setCopie("Copié"), () => setCopie("Sélectionné"))}
          className="min-h-[52px] flex-1 rounded-full text-[15.5px]"
          style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.card, color: colors.ink }}
        >
          {copie}
        </button>
        {peutPartager && (
          <button
            type="button"
            onClick={() => navigator.share({ text: texte })}
            className="atlas-plein min-h-[52px] flex-1 rounded-full border-0 text-[15.5px] font-semibold"
            style={{ backgroundColor: colors.plein, color: colors.card }}
          >
            Envoyer
          </button>
        )}
      </div>
    </Feuille>
  );
}

/** La feuille elle-même : un voile, une boîte qui monte du bas, un titre et « Fermer ». */
function Feuille({ titre, repere, onFermer, children }: { titre: string; repere: string; onFermer: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ backgroundColor: "rgba(0,0,0,.35)" }} onClick={onFermer} data-atlas={repere}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] overflow-auto px-4 pt-[18px]"
        style={{ maxHeight: "86vh", backgroundColor: colors.cream, borderRadius: "18px 18px 0 0", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center">
          <h2 className="m-0 flex-1" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 21, lineHeight: 1.2 }}>
            {titre}
          </h2>
          <button type="button" onClick={onFermer} className="border-0 bg-transparent text-[14px] underline" style={{ color: colors.inkSoft }}>
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
