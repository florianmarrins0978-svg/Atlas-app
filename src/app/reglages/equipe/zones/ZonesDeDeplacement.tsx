"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import Icone from "@/components/atlas/IconeTrait";
import Paquet from "@/components/atlas/reglages/Paquet";
import CocheRonde from "@/components/atlas/reglages/CocheRonde";
import { nombreDeJours } from "@/lib/jours-travailles";
import { MODELES, ZONES_MAX, couleurDeLaCase, zonesLues, type Convention, type ReglageZones, type Zone } from "@/lib/zones-deplacement";
import { reglerLesZonesAction } from "./actions";

/**
 * Le réglage des zones : la convention, le départ, chaque zone (son nom et sa
 * borne), « Ajouter une zone » et « Remettre le barème ». Sa planche du
 * 5 novembre 2026, et ses demandes du soir : *« modifiable »*, *« pouvoir
 * changer le nom des zones, si je veux écrire zone 3C »*.
 *
 * **Chaque changement s'enregistre seul**, la frappe posée : pas de bouton
 * Enregistrer à chercher en bas d'un écran qui défile.
 */

const CHOIX: { valeur: Convention; titre: string; quoi: string }[] = [
  { valeur: "aucune", titre: "Pas de zones", quoi: "Vos salariés n’ont pas d’indemnité par zone" },
  { valeur: "paysage", titre: MODELES.paysage.nom, quoi: MODELES.paysage.sous },
  { valeur: "batiment", titre: MODELES.batiment.nom, quoi: MODELES.batiment.sous },
];

const copie = (z: readonly Zone[]) => z.map((x) => ({ ...x }));

export default function ZonesDeDeplacement({ initial, adresse, sombre }: { initial: ReglageZones; adresse: string | null; sombre: boolean }) {
  const router = useRouter();
  const [convention, setConvention] = useState<Convention>(initial.convention);
  const [zones, setZones] = useState<Zone[]>(copie(initial.zones));
  // Ce qui est tapé, champ par champ : un « 2 » en route vers « 25 » ne doit
  // ni refuser la saisie, ni partir en base.
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [departSitue, setDepartSitue] = useState(initial.depart !== null);
  const [refus, setRefus] = useState<string | null>(null);
  const plusTard = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (plusTard.current) clearTimeout(plusTard.current);
  }, []);

  function enregistrer(c: Convention, z: Zone[], delai = 0) {
    if (plusTard.current) clearTimeout(plusTard.current);
    const geste = async () => {
      setRefus(null);
      const r = await reglerLesZonesAction({ convention: c, zones: z, teinte: initial.teinte });
      if (!r.ok) setRefus(r.raison);
      else setDepartSitue(r.departSitue);
      router.refresh();
    };
    if (delai) plusTard.current = setTimeout(geste, delai);
    else void geste();
  }

  function choisir(c: Convention) {
    const z = c === "aucune" ? [] : c === convention ? zones : copie(MODELES[c].zones);
    setConvention(c);
    setZones(z);
    setSaisies({});
    enregistrer(c, z);
  }

  function changer(i: number, champ: "nom" | "km", texte: string) {
    setSaisies((s) => ({ ...s, [`${champ}${i}`]: texte }));
    const z = copie(zones);
    if (champ === "nom") {
      // Vide, la zone garde son nom plutôt que de devenir une case sans titre.
      if (!texte.trim()) return;
      z[i].nom = texte.trim();
    } else {
      const km = Number(texte.replace(",", ".").trim());
      z[i].km = km;
    }
    // Une borne qui ne dépasse pas la précédente ne s'écrit pas : l'écran
    // attend la suite de la frappe.
    if (!zonesLues(z)) return;
    setZones(z);
    enregistrer(convention, z, 800);
  }

  function ajouter() {
    if (zones.length >= ZONES_MAX) return;
    const der = zones[zones.length - 1];
    const n = zones.length + 1;
    const z = [...copie(zones), { nom: `Zone ${convention === "batiment" ? n - 1 : n}`, km: (der?.km ?? 0) + 10 }];
    setZones(z);
    enregistrer(convention, z);
  }

  function retirer() {
    if (zones.length <= 1) return;
    const z = copie(zones).slice(0, -1);
    setZones(z);
    setSaisies({});
    enregistrer(convention, z);
  }

  function remettre() {
    if (convention === "aucune") return;
    const z = copie(MODELES[convention].zones);
    setZones(z);
    setSaisies({});
    enregistrer(convention, z);
  }

  const n = zones.length + 1;
  const teinte = (k: number) => {
    const c = couleurDeLaCase(k, n, initial.teinte);
    return sombre ? c.sombre : c.clair;
  };

  return (
    <>
      <div role="radiogroup" aria-label="Vos zones" className="mx-[22px] mt-4 overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
        {CHOIX.map((o, rang) => (
          <button
            key={o.valeur}
            type="button"
            role="radio"
            aria-checked={convention === o.valeur}
            onClick={() => choisir(o.valeur)}
            className="relative flex min-h-[60px] w-full items-start gap-3 py-[13px] text-left"
            data-atlas={`convention-${o.valeur}`}
          >
            {rang > 0 && <span aria-hidden className="absolute left-[34px] right-0 top-0 h-px" style={{ backgroundColor: colors.line }} />}
            <span className="mt-px">
              <CocheRonde pris={convention === o.valeur} />
            </span>
            <span className="min-w-0">
              <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                {o.titre}
              </span>
              <span className="mt-0.5 block text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                {o.quoi}
              </span>
            </span>
          </button>
        ))}
      </div>

      {convention !== "aucune" && (
        <>
          <Paquet titre="Départ">
            <div className="py-3.5">
              <span className="block text-[14px] font-semibold" style={{ color: colors.inkSoft }}>
                Les zones partent de
              </span>
              {adresse?.trim() ? (
                <span className="mt-[3px] block text-[17px]" style={{ color: colors.ink }}>
                  Le siège, {adresse}
                </span>
              ) : (
                <Link href="/reglages/identite" className="mt-[3px] block text-[17px] font-semibold" style={{ color: colors.orTexte }}>
                  Écrire l’adresse de l’entreprise
                </Link>
              )}
              <span
                className="mt-1 block text-[13.5px]"
                style={{ color: departSitue || !adresse?.trim() ? colors.inkSoft : colors.carteRougeTexte, fontWeight: departSitue ? 400 : 600 }}
              >
                {departSitue || !adresse?.trim() ? "À vol d’oiseau" : "Cette adresse n’a pas pu être située."}
              </span>
            </div>
          </Paquet>

          <Paquet titre="Les zones">
            <div data-atlas="zones">
              {zones.map((z, i) => {
                const de = i === 0 ? 0 : zones[i - 1].km;
                return (
                  <div key={i} className="relative flex min-h-[60px] items-center gap-1.5">
                    {i > 0 && <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ backgroundColor: colors.line }} />}
                    <span aria-hidden className="h-3.5 w-3.5 flex-none rounded-[4px]" style={{ backgroundColor: teinte(i) }} />
                    <input
                      type="text"
                      autoComplete="off"
                      maxLength={12}
                      aria-label={`Nom de la zone ${i + 1}`}
                      value={saisies[`nom${i}`] ?? z.nom}
                      onChange={(e) => changer(i, "nom", e.target.value)}
                      onBlur={() => setSaisies((s) => ({ ...s, [`nom${i}`]: zones[i]?.nom ?? "" }))}
                      className="w-[76px] min-w-0 flex-none rounded-none border-0 border-b-[1.5px] bg-transparent py-1.5 text-[18px] leading-[1.2] outline-none"
                      style={{ fontFamily: font.display, color: colors.ink, borderColor: colors.line }}
                      data-atlas={`nom-zone-${i}`}
                    />
                    <span className="min-w-0 flex-1 whitespace-nowrap text-[15px]" style={{ color: colors.inkSoft }}>
                      de {nombreDeJours(de)} à
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`${z.nom}, jusqu’à combien de km`}
                      value={saisies[`km${i}`] ?? nombreDeJours(z.km)}
                      onChange={(e) => changer(i, "km", e.target.value)}
                      onBlur={() => setSaisies((s) => ({ ...s, [`km${i}`]: nombreDeJours(zones[i]?.km ?? 0) }))}
                      className="w-14 flex-none rounded-none border-0 border-b-[1.5px] bg-transparent py-1.5 text-center text-[20px] leading-[1.1] tabular-nums outline-none"
                      style={{ fontFamily: font.display, color: colors.ink, borderColor: colors.line }}
                      data-atlas={`km-zone-${i}`}
                    />
                    <span className="flex-none text-[15px]" style={{ color: colors.inkSoft }}>
                      km
                    </span>
                    {/* Cachée, elle garde sa place : les champs restent alignés. */}
                    <button
                      type="button"
                      onClick={retirer}
                      aria-label={`Retirer ${z.nom}`}
                      className="-mr-3 grid h-11 w-11 flex-none place-items-center"
                      style={{ color: colors.inkSoft, visibility: i === zones.length - 1 && zones.length > 1 ? "visible" : "hidden" }}
                    >
                      <Icone nom="croix" taille={18} />
                    </button>
                  </div>
                );
              })}
              <div className="relative flex min-h-[60px] items-center gap-1.5">
                <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ backgroundColor: colors.line }} />
                <span aria-hidden className="h-3.5 w-3.5 flex-none rounded-[4px]" style={{ backgroundColor: teinte(zones.length) }} />
                <span className="w-[76px] flex-none text-[18px]" style={{ fontFamily: font.display }}>
                  Au-delà
                </span>
                <span className="flex-1 text-[15px]" style={{ color: colors.ink }}>
                  Hors zone
                </span>
              </div>
            </div>
          </Paquet>
          <div className="mx-[22px] mt-1.5 flex flex-wrap justify-between gap-x-3">
            {zones.length < ZONES_MAX && (
              <button type="button" onClick={ajouter} className="flex min-h-[44px] items-center gap-1.5 text-[15.5px] font-semibold" style={{ color: colors.orTexte }}>
                <Icone nom="plus" taille={18} />
                Ajouter une zone
              </button>
            )}
            <button type="button" onClick={remettre} className="flex min-h-[44px] items-center text-[15.5px] font-semibold" style={{ color: colors.inkSoft }}>
              Remettre le barème
            </button>
          </div>
          <p className="mx-[22px] mt-2 text-[14px]" style={{ color: colors.inkSoft }}>
            Modèle à vérifier avec votre comptable.
          </p>
        </>
      )}

      {refus && (
        <p role="alert" className="mx-[22px] mt-4 text-[15px] font-semibold" style={{ color: colors.carteRougeTexte }}>
          {refus}
        </p>
      )}
    </>
  );
}
