"use client";

import { useRef, useState } from "react";
import { colors, smallCaps } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { analyserFichierTarifsAction, appliquerImportTarifsAction, type ApercuImport } from "./actions";

type Tarif = { id: string; intitule: string; prix: string; unite: string | null };

/**
 * Reprendre une liste de prix déjà écrite ailleurs.
 *
 * Le patron, le 8 août 2026 : *« si l'utilisateur a déjà un fichier Excel ou un
 * PDF avec ces lignes de prix, il doit pouvoir le rentrer dans les réglages via
 * une touche, et que les prix s'ajoutent automatiquement. »*
 *
 * **« Automatiquement » s'arrête avant l'écriture, et c'est voulu.** Le fichier
 * est lu, et l'écran montre ce qui SERAIT fait : ce qui s'ajoute, ce qui change
 * — avec l'ancien prix à côté du nouveau —, et ce qui n'a pas été compris. Rien
 * n'est enregistré avant son appui.
 *
 * Ce n'est pas de la prudence de principe : ces tarifs-là partent sur les devis
 * de ses clients. Un fichier mal lu écraserait sa grille sans qu'il l'ait vu
 * passer, et il ne le découvrirait que sur un devis déjà envoyé.
 */
export default function ImportTarifs({ onImporte }: { onImporte: (tarifs: Tarif[]) => void }) {
  const champ = useRef<HTMLInputElement>(null);
  const [apercu, setApercu] = useState<ApercuImport | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [bilan, setBilan] = useState<string | null>(null);

  async function choisir(fichier: File | undefined) {
    if (!fichier) return;
    setEnCours(true);
    setBilan(null);
    try {
      const donnees = new FormData();
      donnees.set("fichier", fichier);
      setApercu(await analyserFichierTarifsAction(donnees));
    } catch {
      setApercu({ statut: "refuse", raison: "Ce fichier n'a pas pu être lu. Réessayez." });
    } finally {
      setEnCours(false);
      // Le champ est vidé pour que redéposer LE MÊME fichier redéclenche la
      // lecture : sans cela, corriger sa feuille puis la reprendre ne ferait
      // rien du tout, et l'écran resterait sur l'aperçu périmé.
      if (champ.current) champ.current.value = "";
    }
  }

  async function appliquer() {
    if (!apercu || apercu.statut !== "lu") return;
    setEnCours(true);
    try {
      const r = await appliquerImportTarifsAction({
        creer: apercu.aCreer,
        mettreAJour: apercu.aMettreAJour.map((m) => ({ id: m.id, apres: m.apres })),
      });
      setBilan(
        [
          r.crees > 0 ? `${r.crees} tarif${r.crees > 1 ? "s" : ""} ajouté${r.crees > 1 ? "s" : ""}` : null,
          r.misAJour > 0 ? `${r.misAJour} mis à jour` : null,
          r.refuses > 0 ? `${r.refuses} refusé${r.refuses > 1 ? "s" : ""} au dernier contrôle` : null,
        ]
          .filter(Boolean)
          .join(", ") || "Rien à changer.",
      );
      setApercu(null);
      // La liste vient du serveur, pas d'une reconstitution locale : c'est lui
      // qui a écrit, et lui seul sait ce qui l'a été. Reconstruire ici
      // afficherait un tarif refusé au dernier contrôle comme s'il existait.
      onImporte(r.tarifs);
    } catch {
      setBilan("L'enregistrement n'a pas abouti. Vos tarifs n'ont pas été modifiés.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mt-6 rounded-[4px] p-4" style={{ backgroundColor: colors.card }}>
      <span className={smallCaps} style={{ color: colors.muted }}>
        J&apos;ai déjà mes prix ailleurs
      </span>
      <p className="mt-1.5 text-[13px] leading-snug" style={{ color: colors.muted }}>
        Déposez votre fichier Excel ou CSV : Atlas y lit les désignations, les prix et les unités, et vous montre
        ce qu&apos;il ajouterait <strong>avant</strong>{" "}
        d&apos;enregistrer quoi que ce soit.
      </p>

      <input
        ref={champ}
        id="fichier-tarifs"
        type="file"
        accept=".csv,.xlsx,.xls,.pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => choisir(e.target.files?.[0])}
        className="sr-only"
      />
      <label
        htmlFor="fichier-tarifs"
        className="atlas-plein mt-3 inline-block cursor-pointer rounded-[4px] px-4 py-2.5 text-[14px] font-medium text-white"
        style={{ backgroundColor: colors.plein }}
      >
        {enCours ? "Lecture…" : "Choisir un fichier"}
      </label>

      {bilan && (
        <p className="mt-3 text-[13px]" style={{ color: colors.ink }}>
          {bilan}
        </p>
      )}

      {apercu?.statut === "refuse" && (
        <p role="alert" className="mt-3 text-[13px] leading-snug" style={{ color: colors.rust }}>
          {apercu.raison}
        </p>
      )}

      {apercu?.statut === "lu" && (
        <div className="mt-4 flex flex-col gap-3">
          {apercu.aCreer.length === 0 && apercu.aMettreAJour.length === 0 && (
            <p className="text-[13px]" style={{ color: colors.rust }}>
              {apercu.inchangees.length > 0
                ? "Tous ces tarifs sont déjà les vôtres, à l'identique. Rien à changer."
                : "Aucun tarif n'a pu être lu dans ce fichier."}
            </p>
          )}

          <Bloc titre={`${apercu.aCreer.length} à ajouter`} vide={apercu.aCreer.length === 0}>
            {apercu.aCreer.map((l, i) => (
              <Ligne key={i} intitule={l.intitule} unite={l.unite} droite={enEuros(l.prix)} />
            ))}
          </Bloc>

          {/* Un prix qui change se lit AVEC l'ancien. C'est la seule façon de
              voir qu'un fichier périmé s'apprêtait à faire baisser sa grille. */}
          <Bloc titre={`${apercu.aMettreAJour.length} à corriger`} vide={apercu.aMettreAJour.length === 0}>
            {apercu.aMettreAJour.map((m) => (
              <Ligne
                key={m.id}
                intitule={m.avant.intitule}
                unite={m.apres.unite ?? m.avant.unite}
                droite={
                  <>
                    <span style={{ color: colors.muted, textDecoration: "line-through" }}>
                      {enEuros(m.avant.prix)}
                    </span>{" "}
                    {enEuros(m.apres.prix)}
                  </>
                }
              />
            ))}
          </Bloc>

          {apercu.inchangees.length > 0 && (
            <p className="text-[13px]" style={{ color: colors.muted }}>
              {apercu.inchangees.length} déjà à l&apos;identique.
            </p>
          )}

          {/* Ce qui n'a pas été compris se dit, ligne par ligne. Une liste de
              prix comporte presque toujours des titres de rubrique et des
              sous-totaux : les taire ferait croire à un import complet. */}
          {apercu.ecartees.length > 0 && (
            <details className="text-[13px]" style={{ color: colors.muted }}>
              <summary style={{ color: colors.rust }}>
                {apercu.ecartees.length} ligne{apercu.ecartees.length > 1 ? "s" : ""} laissée
                {apercu.ecartees.length > 1 ? "s" : ""} de côté
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {apercu.ecartees.slice(0, 30).map((e, i) => (
                  <li key={i}>
                    <span style={{ color: colors.ink }}>{e.contenu}</span> — {e.raison}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={appliquer}
              disabled={enCours || (apercu.aCreer.length === 0 && apercu.aMettreAJour.length === 0)}
              className="atlas-plein rounded-full py-2.5 text-[14px] font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: colors.plein }}
            >
              {enCours ? "Enregistrement…" : "Enregistrer ces tarifs"}
            </button>
            <button
              type="button"
              onClick={() => setApercu(null)}
              className="text-[14px] font-medium"
              style={{ color: colors.muted }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Bloc({ titre, vide, children }: { titre: string; vide: boolean; children: React.ReactNode }) {
  if (vide) return null;
  return (
    <div>
      <span className={smallCaps} style={{ color: colors.rust }}>
        {titre}
      </span>
      <ul className="mt-1 flex flex-col gap-1">{children}</ul>
    </div>
  );
}

function Ligne({
  intitule,
  unite,
  droite,
}: {
  intitule: string;
  unite: string | null;
  droite: React.ReactNode;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-[14px]">
      <span className="min-w-0" style={{ color: colors.ink }}>
        {intitule}
        {unite && (
          <span className="text-[12px]" style={{ color: colors.muted }}>
            {" "}
            / {unite}
          </span>
        )}
      </span>
      <span className="shrink-0" style={{ color: colors.ink }}>
        {droite}
      </span>
    </li>
  );
}
