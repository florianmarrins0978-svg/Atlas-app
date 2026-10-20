"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { colors, font, libelleCaps, surPlein } from "@/lib/design-tokens";
import { photoDe } from "@/lib/arrosage/photos";
import { quantiteDeLigne } from "@/lib/arrosage/postes";
import { messageDuComplement, montageDuDevis, reconnaitreLeDevis, type PieceDuDevis } from "@/lib/arrosage/devis-du-plan";
import { refusDuDocumentVehicule } from "@/lib/vehicules";
import { CATALOGUE } from "@/lib/arrosage/catalogue.js";
import { Dessin } from "./NourriceEclatee";
import { ChoisirUnePiece, FeuilleFournisseur } from "./FeuillePiece";
import { lireLeDevisDuPlanAction } from "./actions-fournisseurs";

const CAT = CATALOGUE as unknown as { referenceDe(ref: string): string | null };

/** La photo d'une pièce dans son petit cadre blanc, ou un cadre en pointillé quand elle n'en a pas. */
function VignetteDeLigne({ cle }: { cle: string }) {
  const photo = photoDe(cle);
  return (
    <span
      className="flex h-10 w-10 flex-none items-center justify-center rounded-[8px]"
      style={photo ? { backgroundColor: "#ffffff", boxShadow: `0 0 0 1px ${colors.lineSoft}` } : { border: `1.5px dashed ${colors.line}` }}
    >
      {photo && <Image src={photo} alt="" width={36} height={36} unoptimized className="max-h-9 max-w-9 object-contain" style={{ mixBlendMode: "multiply" }} />}
    </span>
  );
}

type Lu = { connues: PieceDuDevis[]; inconnues: { lu: string }[] };

/**
 * « PAR OÙ COMMENCER » ET L'IMPORT D'UN DEVIS FOURNISSEUR — sa planche du
 * 18 octobre 2026, au mot et à la place près (`appli/arrosage-import-devis.html`).
 *
 * Deux portes : photographier le croquis (le champ du croquis, juste en
 * dessous, celui de toujours), ou partir d'un devis déjà fait chez un
 * fournisseur. Le devis est lu par l'IA, ses pièces reconnues par leur
 * référence (`devis-du-plan.ts`), la nourrice composée au nombre de ses
 * électrovannes (`composerNourrice`, le dessin de `NourriceEclatee`).
 *
 * **Un devis ne dit pas où passent les réseaux** : sans croquis, aucun plan.
 * « Garder la liste sans plan » la garde sur cet écran, comme le plan lui-même,
 * qui ne s'enregistre pas encore (`TODO.md`).
 *
 * Tout ce qui est ici vit dans le formulaire du croquis : aucun champ ne porte
 * de `name`, rien ne part avec la photo du croquis.
 */
export default function DepuisUnDevis() {
  const [ouvert, setOuvert] = useState(false);
  const [fichier, setFichier] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [refus, setRefus] = useState<string | null>(null);
  const [lu, setLu] = useState<Lu | null>(null);
  const [reglees, setReglees] = useState<Record<number, string>>({});
  const [completee, setCompletee] = useState(false);
  const [extras, setExtras] = useState<{ ref: string; nom: string; q: number }[]>([]);
  const [choix, setChoix] = useState<{ pour: number | "ajout" } | null>(null);
  const [message, setMessage] = useState(false);
  const [gardee, setGardee] = useState(false);
  const photo = useRef<HTMLInputElement>(null);
  const autre = useRef<HTMLInputElement>(null);

  const recu = (f: File | undefined) => {
    if (!f) return;
    const r = refusDuDocumentVehicule(f.type, f.size);
    if (r) {
      setRefus(r);
      return;
    }
    setRefus(null);
    setFichier(f.type.startsWith("image/") ? "Photo du devis" : f.name);
    setLu(null);
    setReglees({});
    setCompletee(false);
    setExtras([]);
    setGardee(false);
    const donnees = new FormData();
    donnees.set("fichier", f);
    demarrer(async () => {
      const res = await lireLeDevisDuPlanAction(donnees);
      if (!res.ok) {
        setRefus(res.raison);
        return;
      }
      const r2 = reconnaitreLeDevis(res.lignes);
      setLu(r2);
    });
  };

  // Une ligne « choisie » rejoint les pièces reconnues ; « laissée », elle ne compte pas.
  const connues = useMemo(() => lu?.connues ?? [], [lu]);
  const m = useMemo(() => montageDuDevis(connues, completee), [connues, completee]);
  const champ = (ref: React.RefObject<HTMLInputElement | null>, accept: string, capture?: "environment") => (
    <input
      ref={ref}
      type="file"
      accept={accept}
      capture={capture}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        recu(f);
      }}
    />
  );
  const h2 = "mt-[6px] text-[21px] leading-[1.2]";
  const bouton = "flex min-h-[52px] w-full items-center justify-center rounded-full text-[16px]";
  const plein = { backgroundColor: colors.plein, color: surPlein };
  const creux = { border: `1px solid ${colors.line}`, backgroundColor: colors.card, color: colors.ink };
  const liste = "mt-[10px] rounded-[12px] px-3 py-[2px]";
  const ligne = "flex items-center gap-[10px] border-t py-[9px] text-[14px] first:border-t-0";

  return (
    <div data-atlas="depuis-un-devis">
      <section className="mx-[22px] mt-5">
        <span className={`block ${libelleCaps}`} style={{ color: colors.or }}>
          Plan d’arrosage
        </span>
        <h2 className={h2} style={{ fontFamily: font.display, fontWeight: 400 }}>
          Par où commencer
        </h2>
        <div className="mt-3 flex flex-col gap-[10px]">
          <label
            htmlFor="croquis"
            data-atlas="porte-croquis"
            className="flex min-h-[64px] w-full cursor-pointer items-center gap-[14px] rounded-[14px] px-4 py-3"
            style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.card, color: colors.ink }}
          >
            <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" style={{ color: colors.inkSoft, flex: "none" }}>
              <rect x="4" y="5" width="20" height="18" rx="2" />
              <path d="M8 18l5-6 4 4 3-3" />
            </svg>
            <span>
              <b className="block text-[16px] font-semibold">Photographier le croquis</b>
              <small className="block text-[13px]" style={{ color: colors.muted }}>
                Avec les métrés, le piquage et la nourrice
              </small>
            </span>
          </label>
          <button
            type="button"
            onClick={() => setOuvert(true)}
            data-atlas="porte-devis"
            className="flex min-h-[64px] w-full items-center gap-[14px] rounded-[14px] px-4 py-3 text-left"
            style={{ border: `1.5px dashed ${colors.line}`, backgroundColor: colors.card, color: colors.ink }}
          >
            <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" style={{ color: colors.inkSoft, flex: "none" }}>
              <path d="M8 4h9l5 5v15H8z" />
              <path d="M17 4v5h5M11 14h8M11 18h8" />
            </svg>
            <span>
              <b className="block text-[16px] font-semibold">J’ai déjà un devis fournisseur</b>
              <small className="block text-[13px]" style={{ color: colors.muted }}>
                Photo ou PDF
              </small>
            </span>
          </button>
        </div>
        {champ(photo, "image/jpeg,image/png", "environment")}
        {champ(autre, "application/pdf,image/jpeg,image/png")}
        {ouvert && !fichier && (
          <div className="mt-[10px] flex flex-col gap-2">
            <button type="button" onClick={() => photo.current?.click()} className={`atlas-plein ${bouton}`} style={plein} data-atlas="photo-devis-plan">
              Prendre le devis en photo
            </button>
            <button type="button" onClick={() => autre.current?.click()} className={bouton} style={creux}>
              Choisir une photo ou un PDF
            </button>
          </div>
        )}
        {fichier && (
          <p className="mt-3 flex items-center gap-[10px] rounded-[12px] px-[14px] py-[10px] text-[14px]" style={{ backgroundColor: colors.card }}>
            <span className="min-w-0 flex-1 truncate">{fichier}</span>
            <button type="button" onClick={() => setFichier(null)} className="flex-none text-[13.5px] underline" style={{ color: colors.inkSoft }}>
              Un autre
            </button>
          </p>
        )}
        {enCours && (
          <p className="mt-3 rounded-[12px] px-4 py-[14px] text-[14.5px]" style={{ backgroundColor: colors.card, color: colors.inkSoft }} aria-live="polite">
            Lecture du devis…
          </p>
        )}
        {refus && (
          <p className="mt-3 text-[13.5px]" style={{ color: colors.alert }} data-atlas="refus-devis-plan">
            {refus}
          </p>
        )}
      </section>

      {lu && (
        <>
          <section className="mx-[22px] mt-[26px]" data-atlas="lu-sur-le-devis-plan">
            <span className={`block ${libelleCaps}`} style={{ color: colors.or }}>
              Lu sur le devis
            </span>
            <h2 className={h2} style={{ fontFamily: font.display, fontWeight: 400 }}>
              Les pièces
            </h2>
            <p className="mt-[10px] text-[14.5px]">
              {lu.connues.length + lu.inconnues.length} lignes lues, {lu.connues.length} reconnues.
            </p>
            {lu.inconnues.length > 0 && (
              <>
                <h3 className="mt-[18px] text-[15px] font-semibold" style={{ color: colors.alert }}>
                  Pas dans le catalogue
                </h3>
                {lu.inconnues.map((x, i) => (
                  <div key={i} className="mt-2 rounded-[12px] px-[14px] py-3" style={{ backgroundColor: colors.card, boxShadow: `inset 3px 0 0 ${reglees[i] ? colors.line : colors.alert}` }}>
                    <p className="text-[13px]" style={{ fontFamily: "ui-monospace, Menlo, monospace", color: colors.inkSoft }}>
                      « {x.lu} »
                    </p>
                    {reglees[i] ? (
                      <p className="mt-2 text-[13.5px]" style={{ color: colors.inkSoft }}>
                        {reglees[i]}
                      </p>
                    ) : (
                      <div className="mt-[10px] flex gap-2">
                        <button type="button" onClick={() => setChoix({ pour: i })} className="min-h-[44px] flex-1 rounded-full text-[14px]" style={{ ...creux, backgroundColor: colors.cream }}>
                          Choisir la pièce
                        </button>
                        <button type="button" onClick={() => setReglees({ ...reglees, [i]: "Laissée hors liste." })} className="min-h-[44px] flex-1 rounded-full text-[14px]" style={{ ...creux, backgroundColor: colors.cream }}>
                          Laisser hors liste
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
            <div className={liste} style={{ backgroundColor: colors.card }}>
              {lu.connues.map((c) => (
                <div key={c.cle} className={ligne} style={{ borderColor: colors.line }}>
                  <VignetteDeLigne cle={c.cle} />
                  <span className="min-w-0 flex-1">
                    {c.nom}
                    {c.reference && (
                      <small className="block text-[12px]" style={{ color: colors.muted }}>
                        {c.reference}
                      </small>
                    )}
                  </span>
                  <span className="min-w-[52px] flex-none text-right tabular-nums" style={{ color: colors.orTexte }}>
                    {quantiteDeLigne(c)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-[22px] mt-[26px]" data-atlas="montage-du-devis">
            <span className={`block ${libelleCaps}`} style={{ color: colors.or }}>
              Le montage
            </span>
            <h2 className={h2} style={{ fontFamily: font.display, fontWeight: 400 }}>
              {m.titre}
            </h2>
            <p className="mt-[10px] text-[15px]">{m.phrase}</p>
            {m.nourrice && (
              <>
                <div className="mt-3 overflow-hidden rounded-[16px] py-2" style={{ backgroundColor: "#ffffff", boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
                  <Dessin
                    n={m.nourrice}
                    couleurs={[]}
                    etats={m.nourrice.poses.map((_, i) => (m.absentes.has(i) ? "absente" : ""))}
                    reseauDeVoie={Array.from({ length: m.voies }, (_, i) => i)}
                  />
                </div>
                <h3 className="mt-4 text-[14px] font-semibold">Avec la nourrice</h3>
                <div className="mt-[10px] flex flex-wrap gap-x-2 gap-y-3 rounded-[14px] px-[10px] py-[14px]" style={{ backgroundColor: colors.card }}>
                  {m.bac.map((b) => {
                    const src = photoDe(b.cle);
                    return (
                      <div key={b.cle} className="w-16">
                        <span className="flex h-16 w-16 items-center justify-center rounded-[10px]" style={{ backgroundColor: "#ffffff", ...(b.absente ? { filter: "grayscale(1)", opacity: 0.3 } : {}) }}>
                          {src && <Image src={src} alt="" width={58} height={58} unoptimized className="max-h-[58px] max-w-[58px] object-contain" style={{ mixBlendMode: "multiply" }} />}
                        </span>
                        <span className="mt-1 block text-[10.5px] leading-[1.25]" style={{ color: b.absente ? colors.alert : colors.inkSoft }}>
                          {b.nom}
                        </span>
                        <span className="text-[11px] tabular-nums" style={{ color: colors.orTexte }}>
                          {b.q}x
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {m.manque.length > 0 && (
              <>
                <h3 className="mt-4 text-[14px] font-semibold">{completee ? "Ajoutées à la liste" : "Manquent sur le devis"}</h3>
                <div className={liste} style={{ backgroundColor: colors.card }}>
                  {m.manque.map((x) => (
                    <div key={x.cle} className={ligne} style={{ borderColor: colors.line }}>
                      <VignetteDeLigne cle={x.cle} />
                      <span className="min-w-0 flex-1">{x.nom}</span>
                      <span className="min-w-[52px] flex-none text-right tabular-nums" style={{ color: completee ? colors.orTexte : colors.alert }}>
                        {x.q}x
                      </span>
                    </div>
                  ))}
                </div>
                {!completee && (
                  <button type="button" onClick={() => setCompletee(true)} className={`mt-[10px] ${bouton}`} style={creux}>
                    Ajouter ce qui manque à la liste
                  </button>
                )}
              </>
            )}
            {extras.length > 0 && (
              <>
                <h3 className="mt-4 text-[14px] font-semibold">Ajoutées à la main</h3>
                <div className={liste} style={{ backgroundColor: colors.card }}>
                  {extras.map((x, i) => (
                    <div key={x.ref} className={ligne} style={{ borderColor: colors.line }}>
                      <VignetteDeLigne cle={x.ref} />
                      <span className="min-w-0 flex-1">
                        {x.nom}
                        <small className="block text-[12px]" style={{ color: colors.muted }}>
                          {x.ref}
                        </small>
                      </span>
                      <span className="min-w-[52px] flex-none text-right tabular-nums" style={{ color: colors.orTexte }}>
                        {x.q}x
                      </span>
                      <button type="button" onClick={() => setExtras(extras.filter((_, k) => k !== i))} className="flex-none pl-[6px] text-[13px] underline" style={{ color: colors.alert }}>
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setChoix({ pour: "ajout" })}
              className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-full text-[15px]"
              style={{ border: `1.5px dashed ${colors.line}`, color: colors.ink }}
            >
              Ajouter une pièce
            </button>
            {(m.manque.length > 0 || extras.length > 0) && (
              <button type="button" onClick={() => setMessage(true)} className={`atlas-plein mt-4 ${bouton}`} style={plein} data-atlas="au-fournisseur-devis">
                Envoyer au fournisseur
              </button>
            )}
          </section>

          <section className="mx-[22px] mt-[26px]" data-atlas="il-manque-le-croquis">
            <span className={`block ${libelleCaps}`} style={{ color: colors.or }}>
              Pour le plan
            </span>
            <h2 className={h2} style={{ fontFamily: font.display, fontWeight: 400 }}>
              Il manque le croquis
            </h2>
            <p className="mt-1 text-[13.5px]" style={{ color: colors.muted }}>
              Un devis ne dit pas où passent les réseaux.
            </p>
            <ul className="mt-[10px] list-none rounded-[12px] px-[14px] py-1" style={{ backgroundColor: colors.card }}>
              {["Les métrés du jardin", "L’endroit du piquage", "L’endroit définitif de la nourrice"].map((x) => (
                <li key={x} className="flex items-baseline gap-[10px] border-t py-[9px] text-[14.5px] first:border-t-0" style={{ borderColor: colors.line }}>
                  <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: colors.alert }} />
                  {x}
                </li>
              ))}
            </ul>
            <label htmlFor="croquis" className={`atlas-plein mt-4 cursor-pointer ${bouton}`} style={plein}>
              Ajouter le croquis
            </label>
            <button type="button" onClick={() => setGardee(true)} className={`mt-[10px] ${bouton}`} style={creux}>
              Garder la liste sans plan
            </button>
            {gardee && (
              <p className="mt-[10px] text-[13.5px]" style={{ color: colors.inkSoft }}>
                La liste et la nourrice sont gardées. Le plan se fera avec le croquis.
              </p>
            )}
          </section>
        </>
      )}

      {choix && (
        <ChoisirUnePiece
          titre={choix.pour === "ajout" ? "Ajouter une pièce" : "Choisir la pièce"}
          categorie="nourrice"
          onFermer={() => setChoix(null)}
          onChoix={(p) => {
            const pour = choix.pour;
            setChoix(null);
            if (pour === "ajout") {
              const deja = extras.find((x) => x.ref === p.ref);
              setExtras(deja ? extras.map((x) => (x.ref === p.ref ? { ...x, q: x.q + 1 } : x)) : [...extras, { ref: p.ref, nom: p.nom, q: 1 }]);
              return;
            }
            // La ligne choisie rejoint les pièces reconnues, à la quantité d'une pièce.
            setReglees({ ...reglees, [pour]: `Remplacée par ${p.nom}.` });
            if (lu) setLu({ ...lu, connues: [...lu.connues, { cle: p.ref, nom: p.nom, reference: CAT.referenceDe(p.ref), q: 1, u: "u" }] });
          }}
        />
      )}
      {message && (
        <FeuilleFournisseur
          message={messageDuComplement(m.manque, extras)}
          onFermer={() => setMessage(false)}
          demande={{
            titre: "Complément du devis",
            lignes: [
              ...m.manque.map((x) => ({ designation: x.nom, reference: CAT.referenceDe(x.cle), quantite: `${x.q}x` })),
              ...extras.map((x) => ({ designation: x.nom, reference: x.ref, quantite: `${x.q}x` })),
            ],
          }}
        />
      )}
    </div>
  );
}
