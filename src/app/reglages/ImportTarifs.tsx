"use client";

import { useRef, useState } from "react";
import ActionBas from "@/components/atlas/reglages/ActionBas";
import PlageTon, { teintesDuTon, type Ton } from "@/components/atlas/reglages/PlageTon";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { analyserFichierTarifsAction, appliquerImportTarifsAction, type ApercuImport } from "./actions";
import Picto from "@/components/atlas/reglages/Picto";

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
 *
 * **Les cas se disent en couleur** (planche soignée du 26 octobre 2026,
 * `appli/soignee/reglages-tarifs.html`) : vert ce qui s'ajoute, ambre ce qui
 * change, l'ancien prix barré devant. « Enregistrer ces tarifs » passe
 * au-dessus de la barre, seul bouton plein de l'écran, et seulement quand un
 * fichier attend.
 *
 * `children` est la suite de l'écran : le bouton du bas réserve sa hauteur là
 * où il est posé (`ActionBas`), il doit donc venir APRÈS elle. Posé avant, sa
 * cale creusait un trou entre l'aperçu et « Mes autres prix ».
 */
export default function ImportTarifs({
  onImporte,
  children,
}: {
  onImporte: (tarifs: Tarif[]) => void;
  children: React.ReactNode;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const [apercu, setApercu] = useState<ApercuImport | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [bilan, setBilan] = useState<{ ton: Ton; texte: string } | null>(null);

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
      const texte =
        [
          r.crees > 0 ? `${r.crees} tarif${r.crees > 1 ? "s" : ""} ajouté${r.crees > 1 ? "s" : ""}` : null,
          r.misAJour > 0 ? `${r.misAJour} mis à jour` : null,
          r.refuses > 0 ? `${r.refuses} refusé${r.refuses > 1 ? "s" : ""} au dernier contrôle` : null,
        ]
          .filter(Boolean)
          .join(", ") || "Rien à changer.";
      // Le vert dit ce qui est entré ; un refus au dernier contrôle reste à
      // regarder, il passe donc en ambre.
      setBilan({ ton: r.refuses > 0 ? "ambre" : r.crees + r.misAJour > 0 ? "vert" : "bleu", texte });
      setApercu(null);
      // La liste vient du serveur, pas d'une reconstitution locale : c'est lui
      // qui a écrit, et lui seul sait ce qui l'a été. Reconstruire ici
      // afficherait un tarif refusé au dernier contrôle comme s'il existait.
      onImporte(r.tarifs);
    } catch {
      setBilan({ ton: "rouge", texte: "L'enregistrement n'a pas abouti. Vos tarifs n'ont pas été modifiés." });
    } finally {
      setEnCours(false);
    }
  }

  const rienAChanger = apercu?.statut === "lu" && apercu.aCreer.length === 0 && apercu.aMettreAJour.length === 0;

  return (
    <>
      <div className="mx-[22px]">
        {/* **Un lien texte sous la liste, et plus le seul bouton plein de
            l'écran** : la planche validée le 11 octobre 2026
            (`appli/mes-tarifs-corrige.html`). Reprendre ses prix d'un fichier ne
            sert qu'une fois.
            « Excel ou CSV », et pas le PDF que l'attribut `accept` laisse
            choisir : la lecture ne rend que ces deux-là. */}
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
          className="mt-1.5 inline-flex min-h-[52px] cursor-pointer items-center gap-2 px-[2px] text-left text-[15px] text-balance"
          style={{ color: colors.inkSoft }}
        >
          <Picto nom="importer" taille={20} />
          {enCours ? "Lecture…" : "Reprendre mes prix d'un fichier Excel ou CSV"}
        </label>

        {bilan && (
          <div className="mt-2">
            <PlageTon ton={bilan.ton}>{bilan.texte}</PlageTon>
          </div>
        )}

        {/* Un PDF refusé, et pourquoi, en ambre : c'est ce qui reste à faire. */}
        {apercu?.statut === "refuse" && (
          <div role="alert" className="mt-2">
            <PlageTon ton="ambre">{apercu.raison}</PlageTon>
          </div>
        )}

        {apercu?.statut === "lu" && (
          <div className="mt-2.5 rounded-[6px] px-[18px] pb-1.5 pt-4" style={{ backgroundColor: colors.card }}>
            {rienAChanger && (
              <p
                className="mb-3 text-[15px] leading-[1.45]"
                style={
                  apercu.inchangees.length > 0
                    ? { color: colors.inkSoft }
                    : { color: colors.carteAmbreTexte, fontWeight: 600 }
                }
              >
                {apercu.inchangees.length > 0
                  ? "Tous ces tarifs sont déjà les vôtres, à l'identique. Rien à changer."
                  : "Aucun tarif n'a pu être lu dans ce fichier."}
              </p>
            )}

            <Bloc ton="vert" titre={`${apercu.aCreer.length} à ajouter`} vide={apercu.aCreer.length === 0}>
              {apercu.aCreer.map((l, i) => (
                <Ligne key={i} premiere={i === 0} intitule={l.intitule} unite={l.unite} prix={enEuros(l.prix)} />
              ))}
            </Bloc>

            {/* Un prix qui change se lit AVEC l'ancien. C'est la seule façon de
                voir qu'un fichier périmé s'apprêtait à faire baisser sa grille. */}
            <Bloc ton="ambre" titre={`${apercu.aMettreAJour.length} à corriger`} vide={apercu.aMettreAJour.length === 0}>
              {apercu.aMettreAJour.map((m, i) => (
                <Ligne
                  key={m.id}
                  premiere={i === 0}
                  intitule={m.avant.intitule}
                  unite={m.apres.unite ?? m.avant.unite}
                  avant={enEuros(m.avant.prix)}
                  prix={enEuros(m.apres.prix)}
                />
              ))}
            </Bloc>

            {apercu.inchangees.length > 0 && !rienAChanger && (
              <p className="mt-4 text-[14.5px]" style={{ color: colors.inkSoft }}>
                {apercu.inchangees.length} déjà à l&apos;identique.
              </p>
            )}

            {/* Ce qui n'a pas été compris se dit, ligne par ligne. Une liste de
                prix comporte presque toujours des titres de rubrique et des
                sous-totaux : les taire ferait croire à un import complet.
                **Sa raison se lit DESSOUS, en phrase** : le tiret qui la collait
                au contenu est parti avec la règle du 22 septembre 2026. */}
            {apercu.ecartees.length > 0 && (
              <details className="group relative mt-3.5 pb-2 pt-1">
                <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ backgroundColor: colors.line }} />
                <summary
                  className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 text-[15.5px] font-semibold [&::-webkit-details-marker]:hidden"
                  style={{ color: colors.carteAmbreTexte }}
                >
                  {apercu.ecartees.length} ligne{apercu.ecartees.length > 1 ? "s" : ""} laissée
                  {apercu.ecartees.length > 1 ? "s" : ""} de côté
                  <span className="transition-transform duration-200 group-open:rotate-180">
                    <Picto nom="bas" taille={20} />
                  </span>
                </summary>
                <ul>
                  {apercu.ecartees.slice(0, 30).map((e, i) => (
                    <li
                      key={i}
                      className="py-2 text-[15px]"
                      style={{ color: colors.ink, borderTop: i === 0 ? undefined : `1px solid ${colors.line}` }}
                    >
                      {e.contenu}
                      <span className="mt-[2px] block text-[14px]" style={{ color: colors.inkSoft }}>
                        {e.raison}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {children}

      {apercu?.statut === "lu" && (
        <ActionBas>
          <button
            type="button"
            onClick={appliquer}
            disabled={enCours || rienAChanger}
            className="atlas-plein flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full px-[22px] text-[17px] font-semibold disabled:opacity-40"
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            <Picto nom="coche" />
            {enCours ? "Enregistrement…" : "Enregistrer ces tarifs"}
          </button>
          <button
            type="button"
            onClick={() => setApercu(null)}
            className="mt-0.5 flex min-h-[44px] w-full items-center justify-center text-[16px] font-semibold"
            style={{ color: colors.inkSoft }}
          >
            Annuler
          </button>
        </ActionBas>
      )}
    </>
  );
}

/** Un cas de l'aperçu : sa pastille de couleur, puis ses lignes. */
function Bloc({ ton, titre, vide, children }: { ton: Ton; titre: string; vide: boolean; children: React.ReactNode }) {
  if (vide) return null;
  const { fond, texte } = teintesDuTon(ton);
  return (
    <div className="mb-[18px] last:mb-0">
      {/* Un point ET un mot, jamais la couleur seule. */}
      <span
        className="mb-1 inline-flex min-h-[28px] items-center gap-[7px] whitespace-nowrap rounded-full px-[11px] text-[13.5px] font-semibold leading-none"
        style={{ backgroundColor: fond, color: texte }}
      >
        <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full" style={{ backgroundColor: texte }} />
        {titre}
      </span>
      <ul>{children}</ul>
    </div>
  );
}

/**
 * Une ligne de l'aperçu, dans l'écriture des tarifs : le nom en serif, l'unité
 * dessous (« par jour »), le montant en gras, l'ancien barré devant.
 */
function Ligne({
  premiere,
  intitule,
  unite,
  prix,
  avant,
}: {
  premiere: boolean;
  intitule: string;
  unite: string | null;
  prix: string;
  avant?: string;
}) {
  return (
    <li
      className="flex items-baseline justify-between gap-3 py-2.5"
      style={premiere ? undefined : { borderTop: `1px solid ${colors.line}` }}
    >
      <span className="min-w-0 text-[17.5px] leading-[1.3]" style={{ fontFamily: font.display, color: colors.ink }}>
        {intitule}
        {unite && (
          <span className="mt-0.5 block text-[14px]" style={{ fontFamily: font.body, color: colors.inkSoft }}>
            par {unite}
          </span>
        )}
      </span>
      <span
        className="flex-none whitespace-nowrap text-[16.5px] font-bold"
        style={{ color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
      >
        {avant && (
          <s className="mr-1.5 font-normal" style={{ color: colors.inkSoft }}>
            {avant}
          </s>
        )}
        {prix}
      </span>
    </li>
  );
}
