"use client";

import { useState } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import Icone from "./Icones";
import { CATEGORIES, piecesVisibles, type Choix } from "@/lib/arrosage/choix-de-pieces";
import { photoDe } from "@/lib/arrosage/photos";
import type { PieceChoisie } from "@/lib/arrosage/retouches";
import { DEBUT_DU_MESSAGE, FIN_DU_MESSAGE, lienDuMail } from "@/lib/arrosage/postes";
import type { LigneDemandeEnvoyee } from "@/server/db/schema";
import { enregistrerLaDemandeAction } from "./actions-fournisseurs";
import { reglerContactAction } from "@/app/reglages/fournisseurs/actions";
import type { SonFournisseur } from "./LePlanDuJardin";
import EnregistrerLaDemande from "./EnregistrerLaDemande";

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
    <Feuille titre={menu.titre} onFermer={onFermer} repere="menu-piece" garder>
      {menu.proposee && (
        <p className="mb-3 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
          Proposée : {menu.proposee}
        </p>
      )}
      <div className="flex flex-col gap-[10px]">
        {menu.nombre > 1 && (
          <label className="mb-[2px] flex min-h-[60px] items-center gap-3 rounded-[6px] px-4" style={{ backgroundColor: colors.card }}>
            <span className="flex-1 text-[16px]">Combien</span>
            <span className="relative">
            <select
              aria-label="Combien de pièces"
              data-atlas="combien"
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="appearance-none rounded-[10px] border-0 py-2 pl-[14px] pr-[34px] text-[16px] font-semibold"
              style={{ minWidth: 110, minHeight: 44, color: colors.ink, backgroundColor: colors.cream, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            >
              {Array.from({ length: menu.nombre }, (_, i) => menu.nombre - i).map((k) => (
                <option key={k} value={k}>
                  {k === menu.nombre ? `toutes les ${k}` : k === 1 ? "une seule" : k}
                </option>
              ))}
            </select>
            {/* Le chevron doré du kit, dessiné par-dessus : l'ancien, une image en dur, restait noir sur les chartes sombres. */}
            <span aria-hidden="true" className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2" style={{ color: colors.or }}>
              <Icone nom="bas" taille={18} />
            </span>
            </span>
          </label>
        )}
        {menu.gestes.map((g) => (
          <button
            key={g.libelle}
            type="button"
            data-atlas="geste"
            onClick={() => { g.agir(n); onFermer(); }}
            className="min-h-[56px] rounded-full border-0 bg-transparent text-[17px] font-semibold"
            style={{ boxShadow: `inset 0 0 0 1.5px ${g.danger ? voile(colors.alert, 0.55) : colors.line}`, color: g.danger ? colors.alert : colors.ink }}
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
  titre: "Changer la pièce" | "Ajouter une pièce" | "Choisir la pièce";
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

/**
 * Le message au fournisseur. **Chez le fournisseur de la pastille** (sa planche
 * du 20 octobre 2026, `appli/arrosage-prix-par-fournisseur.html`) : « Écrire à »
 * lui ouvre le mail, son adresse déjà écrite, et range la liste dans ses
 * Demandes envoyées ; le début et la fin sont les siens, gardés pour les
 * prochaines fois, la liste au milieu est celle de l'outil, sans prix.
 * **Sans fournisseur de pastille** (le complément d'un devis, ou aucun
 * fournisseur) : il lit, copie, ou envoie par le partage du téléphone, et
 * choisit chez qui la liste s'enregistre.
 */
export function FeuilleFournisseur({
  message,
  liste,
  onFermer,
  destinataire,
  demande,
  surMessageGarde,
}: {
  message: string;
  /** La liste seule, entre son début et sa fin ; sans elle, pas de mail au fournisseur. */
  liste?: string;
  onFermer: () => void;
  destinataire?: SonFournisseur;
  /** Ce qui s'enregistre chez lui quand le mail s'ouvre. */
  demande: { titre: string; lignes: LigneDemandeEnvoyee[] };
  surMessageGarde?: (id: string, champs: { debut: string | null; fin: string | null }) => void;
}) {
  if (destinataire && liste !== undefined) return <MailAuFournisseur f={destinataire} liste={liste} demande={demande} onFermer={onFermer} surMessageGarde={surMessageGarde} />;
  return <SansFournisseur message={message} demande={demande} onFermer={onFermer} />;
}

function SansFournisseur({ message, demande, onFermer }: { message: string; demande: { titre: string; lignes: LigneDemandeEnvoyee[] }; onFermer: () => void }) {
  const [texte, setTexte] = useState(message);
  const [parti, setParti] = useState(0);
  const [copie, setCopie] = useState<"Copier" | "Copié" | "Sélectionné">("Copier");
  const peutPartager = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <Feuille titre="Au fournisseur" onFermer={onFermer} repere="fournisseur">
      <p className="mb-[14px] text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
        Tout est additionné, sans prix. Vous pouvez modifier le texte.
      </p>
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        aria-label="Le message au fournisseur"
        data-atlas="message-fournisseur"
        className="block min-h-[300px] w-full resize-y rounded-[6px] border-0 px-[15px] py-[14px] text-[16px] leading-[1.5]"
        style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}` }}
      />
      <EnregistrerLaDemande titre={demande.titre} lignes={demande.lignes} parti={parti} />
      <div className="mt-[14px] flex gap-[10px]">
        <button
          type="button"
          onClick={() => {
            setParti((n) => n + 1);
            navigator.clipboard.writeText(texte).then(() => setCopie("Copié"), () => setCopie("Sélectionné"));
          }}
          className="min-h-[56px] flex-1 rounded-full border-0 bg-transparent text-[17px] font-semibold"
          style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
        >
          {copie}
        </button>
        {peutPartager && (
          <button
            type="button"
            onClick={() => {
              setParti((n) => n + 1);
              navigator.share({ text: texte });
            }}
            className="atlas-plein flex min-h-[56px] flex-1 items-center justify-center gap-[10px] rounded-full border-0 text-[17px] font-semibold"
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            <Icone nom="envoyer" />
            Envoyer
          </button>
        )}
      </div>
    </Feuille>
  );
}

function MailAuFournisseur({
  f,
  liste,
  demande,
  onFermer,
  surMessageGarde,
}: {
  f: SonFournisseur;
  liste: string;
  demande: { titre: string; lignes: LigneDemandeEnvoyee[] };
  onFermer: () => void;
  surMessageGarde?: (id: string, champs: { debut: string | null; fin: string | null }) => void;
}) {
  const [debut, setDebut] = useState(f.debut ?? DEBUT_DU_MESSAGE);
  const [fin, setFin] = useState(f.fin ?? FIN_DU_MESSAGE);
  const [garde, setGarde] = useState<string | null>(null);
  const [enregistree, setEnregistree] = useState<string | null>(null);
  const adresse = f.email?.trim() || null;
  const corps = [debut, "", liste, "", fin].join("\n");

  // Gardé dès qu'il quitte la case : la prochaine fois, son « Bonjour Julien » est là.
  const garder = (quoi: "debut" | "fin", valeur: string) => {
    const avant = quoi === "debut" ? (f.debut ?? DEBUT_DU_MESSAGE) : (f.fin ?? FIN_DU_MESSAGE);
    if (valeur === avant) return;
    reglerContactAction(f.id, { [quoi]: valeur }).then(
      (r) => {
        if (!r.ok) return setGarde(r.raison);
        setGarde(`Gardé pour ${f.nom}, pour les prochaines fois.`);
        surMessageGarde?.(f.id, { debut: r.debut, fin: r.fin });
      },
      () => setGarde("Ce n’a pas pu être gardé. Réessayez.")
    );
  };

  const case_ = "mt-[10px] block min-h-[84px] w-full resize-y rounded-[6px] border-0 px-[15px] py-[14px] text-[16px] leading-[1.5]";
  const styleCase = { backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}` };
  const choix = "mt-[14px] text-[15px] leading-[1.45]";
  return (
    <Feuille titre="Au fournisseur" onFermer={onFermer} repere="fournisseur">
      <p className={choix} style={{ color: colors.inkSoft, overflowWrap: "anywhere" }} data-atlas="destinataire">
        À : {adresse ?? "adresse à ajouter"}
      </p>
      <a
        href={lienDuMail(adresse, corps)}
        onClick={() => {
          enregistrerLaDemandeAction(f.id, demande.titre, demande.lignes).then(
            (r) => setEnregistree(r.ok ? `Enregistrée chez ${r.nom}, dans Réglages, Demandes envoyées, le ${new Date().toLocaleDateString("fr-FR")}.` : r.raison),
            () => setEnregistree("La liste n’a pas pu être enregistrée. Réessayez.")
          );
        }}
        data-atlas="ecrire-au-fournisseur"
        className="atlas-plein mt-[10px] flex min-h-[56px] items-center justify-center gap-[10px] rounded-full text-[17px] font-semibold no-underline"
        style={{ backgroundColor: colors.plein, color: surPlein }}
      >
        <Icone nom="envoyer" />
        Écrire à {f.nom}
      </a>
      {!adresse && (
        <p className="mt-[10px] text-[13.5px]" style={{ color: colors.alert }} data-atlas="sans-adresse">
          Ajoutez l’adresse de {f.nom} dans Réglages, sur sa fiche : le mail s’ouvrira sans destinataire.
        </p>
      )}
      {enregistree && (
        <p className={choix} style={{ color: colors.inkSoft }} data-atlas="demande-enregistree">
          {enregistree}
        </p>
      )}
      <label className={`${choix} block`} style={{ color: colors.inkSoft }}>
        Le début, gardé pour {f.nom}
        <textarea value={debut} onChange={(e) => setDebut(e.target.value)} onBlur={(e) => garder("debut", e.currentTarget.value)} aria-label="Le début du message" data-atlas="debut-du-message" className={case_} style={styleCase} />
      </label>
      <p className={choix} style={{ color: colors.inkSoft }}>La liste, faite par l’outil, sans prix</p>
      <pre
        className="mt-[10px] max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-[6px] px-[15px] py-[14px] text-[15px] leading-[1.5]"
        style={{ backgroundColor: colors.card, color: colors.inkSoft, fontFamily: "inherit" }}
        data-atlas="liste-du-message"
      >
        {liste}
      </pre>
      <label className={`${choix} block`} style={{ color: colors.inkSoft }}>
        La fin, gardée pour {f.nom}
        <textarea value={fin} onChange={(e) => setFin(e.target.value)} onBlur={(e) => garder("fin", e.currentTarget.value)} aria-label="La fin du message" data-atlas="fin-du-message" className={case_} style={styleCase} />
      </label>
      {garde && (
        <p className={choix} style={{ color: colors.inkSoft }} data-atlas="message-garde">
          {garde}
        </p>
      )}
    </Feuille>
  );
}

/**
 * La feuille elle-même : un voile, une boîte qui monte du bas, sa poignée, un
 * titre et « Fermer ». Le menu d'une pièce, lui, se referme par « Garder » sous
 * ses gestes, comme sur la planche soignée du 26 octobre 2026 : la dernière
 * chose qu'on lit est qu'on peut ne rien changer.
 */
function Feuille({ titre, repere, onFermer, garder = false, children }: { titre: string; repere: string; onFermer: () => void; garder?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ backgroundColor: "rgba(0,0,0,.35)" }} onClick={onFermer} data-atlas={repere}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] overflow-auto px-[22px] pt-[10px]"
        style={{ maxHeight: "88vh", backgroundColor: colors.cream, borderRadius: "26px 26px 0 0", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div aria-hidden="true" className="mx-auto mb-3 h-[5px] w-10 rounded-[3px]" style={{ backgroundColor: voile(colors.ink, 0.22) }} />
        <div className="mb-4 flex items-center gap-3">
          <h2 className="m-0 min-w-0 flex-1" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 26, lineHeight: 1.15 }}>
            {titre}
          </h2>
          {!garder && (
            <button type="button" onClick={onFermer} className="min-h-[48px] border-0 bg-transparent px-1 text-[16px] font-semibold" style={{ color: colors.inkSoft }}>
              Fermer
            </button>
          )}
        </div>
        {children}
        {garder && (
          <button type="button" onClick={onFermer} className="mt-[10px] min-h-[48px] w-full border-0 bg-transparent text-[16px] font-semibold" style={{ color: colors.inkSoft }}>
            Garder
          </button>
        )}
      </div>
    </div>
  );
}
