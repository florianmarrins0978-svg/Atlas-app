"use client";

import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { jourNumerique } from "@/lib/jour";
import {
  majEmetteurAction,
  majClientDuDevisAction,
  majAdresseChantierAction,
  majLigneAction,
  ajouterLigneAction,
  retirerLigneAction,
  majEnTeteDevisAction,
} from "./actions";

// **Le devis, seul sur sa page — et à l'image du papier.**
//
// Le patron, le 5 août 2026 : « une page où il n'y a QUE le devis, celui
// d'Arborea. C'est pour les patrons qui auront envie de le remplir à la main,
// qui n'ont pas envie d'utiliser la note vocale. »
//
// La mise en page reprend `appli/devis-modele.html`, qu'il avait construit
// lui-même : en-tête avec les références à droite, titre, émetteur et client
// côte à côte, tableau avec ses colonnes, totaux alignés à droite, conditions,
// cadre de signature. C'est aussi ce que le PDF imprime (`ARCHITECTURE.md`
// §16) — ce qui est à l'écran est ce que son client recevra.
//
// **Une feuille, pas un formulaire.** Les champs n'ont ni cadre ni fond tant
// qu'on n'y touche pas : ils se soulignent au survol et à la saisie. Un devis
// couvert de boîtes grises ressemble à un écran de saisie, et c'est
// précisément ce qu'il ne voulait plus.
//
// **Ce qui change par rapport au fichier d'origine** : celui-ci gardait tout
// dans le navigateur (`localStorage`). Ici chaque champ part vers SA source —
// l'entreprise, la fiche du client, le chantier, les lignes de prix — pour que
// la facture de fin de chantier et le relevé de TVA continuent d'en découler.

type Ligne = { id: string; libelle: string; quantite: string; prixUnitaire: string; montant: string };

type Props = {
  chantierId: string;
  devisId: string;
  numeroCommercial: string;
  dateEmission: string;
  validite: string;
  statut: "brouillon" | "envoye";
  emetteur: { nom: string; adresse: string; siret: string; telephone: string; email: string; iban: string };
  clientId: string | null;
  client: { nom: string; adresse: string; telephone: string; email: string };
  adresseChantier: string;
  lignesInitiales: Ligne[];
  tauxTva: string;
  conditionsPaiement: string;
  /** La dictée n'a pas été comprise, seulement recopiée — voir `lecture-litterale.ts`. */
  lectureLitterale?: boolean;
};

export default function DevisCompletClient(props: Props) {
  const fige = props.statut === "envoye";

  const [emetteur, setEmetteur] = useState(props.emetteur);
  const [client, setClient] = useState(props.client);
  const [adresseChantier, setAdresseChantier] = useState(props.adresseChantier);
  const [lignes, setLignes] = useState<Ligne[]>(
    props.lignesInitiales.map((l) => ({ ...l, quantite: sansZerosInutiles(l.quantite), prixUnitaire: sansZerosInutiles(l.prixUnitaire) }))
  );
  const [tauxTva, setTauxTva] = useState(sansZerosInutiles(props.tauxTva));
  const [conditions, setConditions] = useState(props.conditionsPaiement);

  // Les totaux se recalculent sous ses yeux, à chaque frappe : un devis dont le
  // total n'apparaît qu'après enregistrement se relit deux fois.
  const totalHt = lignes.reduce((somme, l) => somme + montantDeLaLigne(l), 0);
  const totalTva = (totalHt * nombre(tauxTva)) / 100;

  function majLigneLocale(id: string, champ: keyof Ligne, valeur: string) {
    setLignes((cur) => cur.map((l) => (l.id === id ? { ...l, [champ]: valeur } : l)));
  }

  async function persisterLigne(l: Ligne) {
    await majLigneAction(l.id, {
      libelle: l.libelle,
      quantite: normaliser(l.quantite, "1"),
      prixUnitaire: normaliser(l.prixUnitaire, "0"),
    });
  }

  async function ajouter() {
    const creee = await ajouterLigneAction(props.chantierId);
    setLignes((cur) => [...cur, { id: creee.id, libelle: "", quantite: "1", prixUnitaire: "", montant: "0.00" }]);
  }

  async function retirer(id: string) {
    setLignes((cur) => cur.filter((l) => l.id !== id));
    await retirerLigneAction(id);
  }

  return (
    <article
      className="mx-auto w-full max-w-[820px] rounded-[10px] px-5 py-7 sm:px-12 sm:py-12"
      style={{ backgroundColor: colors.card, boxShadow: "0 12px 40px rgba(28,28,26,0.10)" }}
    >
      {props.lectureLitterale && !fige && (
        <p className="mb-6 rounded-lg px-4 py-3 text-[13px]" style={{ backgroundColor: colors.rustTint, color: colors.rust }}>
          Votre dictée a été recopiée mot à mot : aucun modèle n&apos;était disponible pour la comprendre. Relisez les
          lignes de près avant d&apos;envoyer.
        </p>
      )}

      {fige && (
        <p className="mb-6 rounded-lg px-4 py-3 text-[13px]" style={{ backgroundColor: colors.rustTint, color: colors.rust }}>
          Ce devis est parti chez votre client : il ne se modifie plus. Pour le corriger, ouvrez l&apos;écran Devis et
          choisissez « Corriger et renvoyer ».
        </p>
      )}

      {/* --- En-tête : l'entreprise à gauche, les références à droite -------- */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <ChampNu
            valeur={emetteur.nom}
            fige={fige}
            placeholder="Votre entreprise"
            aria="Nom de l'entreprise"
            grand
            onChange={(v) => setEmetteur({ ...emetteur, nom: v })}
            onFini={() => majEmetteurAction({ nom: emetteur.nom })}
          />
          <ChampNu valeur={emetteur.telephone} fige={fige} placeholder="Téléphone" aria="Téléphone de l'entreprise"
            onChange={(v) => setEmetteur({ ...emetteur, telephone: v })}
            onFini={() => majEmetteurAction({ telephone: emetteur.telephone })} />
          <ChampNu valeur={emetteur.email} fige={fige} placeholder="E-mail" aria="E-mail de l'entreprise"
            onChange={(v) => setEmetteur({ ...emetteur, email: v })}
            onFini={() => majEmetteurAction({ email: emetteur.email })} />
        </div>

        <div className="w-full sm:w-[280px] sm:shrink-0">
          <Reference libelle="Devis n°" valeur={props.numeroCommercial} />
          <Reference libelle="Date" valeur={jourNumerique(props.dateEmission)} />
          <Reference libelle="Validité" valeur={props.validite} />
        </div>
      </header>

      <div className="my-6" style={{ borderTop: `2px solid ${colors.ink}` }} />

      <h1 className="mb-8 text-center text-[26px] tracking-[0.14em] sm:text-[30px]" style={{ fontFamily: font.display }}>
        DEVIS
      </h1>

      {/* --- Émetteur et client, côte à côte comme sur le papier ------------- */}
      <section className="grid gap-7 sm:grid-cols-2">
        <div>
          <Intertitre>Émetteur</Intertitre>
          <ChampNu valeur={emetteur.adresse} fige={fige} placeholder="Adresse du siège social" aria="Adresse de l'entreprise"
            onChange={(v) => setEmetteur({ ...emetteur, adresse: v })}
            onFini={() => majEmetteurAction({ adresse: emetteur.adresse })} />
          <ChampNu valeur={emetteur.siret} fige={fige} placeholder="N° SIREN / SIRET" aria="SIREN / SIRET"
            onChange={(v) => setEmetteur({ ...emetteur, siret: v })}
            onFini={() => majEmetteurAction({ siret: emetteur.siret })} />
        </div>

        <div>
          <Intertitre>Client</Intertitre>
          {props.clientId ? (
            <>
              <ChampNu valeur={client.nom} fige={fige} placeholder="Nom complet" aria="Nom du client"
                onChange={(v) => setClient({ ...client, nom: v })}
                onFini={() => majClientDuDevisAction(props.clientId!, { nom: client.nom })} />
              <ChampNu valeur={client.adresse} fige={fige} placeholder="Adresse" aria="Adresse du client"
                onChange={(v) => setClient({ ...client, adresse: v })}
                onFini={() => majClientDuDevisAction(props.clientId!, { adresse: client.adresse })} />
              <ChampNu valeur={client.telephone} fige={fige} placeholder="Téléphone" aria="Téléphone du client"
                onChange={(v) => setClient({ ...client, telephone: v })}
                onFini={() => majClientDuDevisAction(props.clientId!, { telephone: client.telephone })} />
              <ChampNu valeur={client.email} fige={fige} placeholder="E-mail" aria="E-mail du client"
                onChange={(v) => setClient({ ...client, email: v })}
                onFini={() => majClientDuDevisAction(props.clientId!, { email: client.email })} />
            </>
          ) : (
            <p className="text-[13px]" style={{ color: colors.muted }}>
              Aucun client rattaché à ce chantier.
            </p>
          )}
          <ChampNu valeur={adresseChantier} fige={fige} placeholder="Chantier : adresse des travaux" aria="Adresse du chantier"
            onChange={setAdresseChantier}
            onFini={() => majAdresseChantierAction(props.chantierId, adresseChantier)} />
        </div>
      </section>

      {/* --- Le tableau ------------------------------------------------------ */}
      <section className="mt-9">
        {/* Les en-têtes de colonnes n'apparaissent qu'à partir du format
            tablette : sur six pouces, chaque cellule porte son propre libellé,
            comme le fait le modèle d'origine. */}
        <div
          className="hidden pb-2 sm:grid sm:grid-cols-[1fr_70px_130px_130px_28px] sm:gap-3"
          style={{ borderBottom: `1px solid ${colors.ink}` }}
        >
          <Colonne>Description</Colonne>
          <Colonne droite>Qté</Colonne>
          <Colonne droite>Prix unitaire HT</Colonne>
          <Colonne droite>Total HT</Colonne>
          <span />
        </div>

        {lignes.length === 0 && (
          <p className="py-4 text-[13px]" style={{ color: colors.muted }}>
            Aucune ligne pour l&apos;instant.
          </p>
        )}

        {lignes.map((l, i) => (
          <div
            key={l.id}
            className="grid gap-2 py-3 sm:grid-cols-[1fr_70px_130px_130px_28px] sm:items-start sm:gap-3"
            style={{ borderBottom: `1px solid ${colors.lineSoft}` }}
          >
            <textarea
              value={l.libelle}
              readOnly={fige}
              rows={2}
              aria-label={`Description ${i + 1}`}
              placeholder="Ex : Élagage d'un tilleul — taille architecturée"
              onChange={(e) => majLigneLocale(l.id, "libelle", e.target.value)}
              onBlur={() => persisterLigne(l)}
              className="w-full resize-none border-0 bg-transparent p-0 outline-none focus:bg-[rgba(0,0,0,0.03)]"
              style={{ color: colors.ink, fontSize: "16px", lineHeight: 1.45 }}
            />

            <Cellule libelle="Qté">
              <input
                value={l.quantite}
                readOnly={fige}
                inputMode="decimal"
                aria-label={`Quantité ${i + 1}`}
                onChange={(e) => majLigneLocale(l.id, "quantite", e.target.value)}
                onBlur={() => persisterLigne(l)}
                className="w-16 border-0 bg-transparent p-0 text-right outline-none focus:bg-[rgba(0,0,0,0.03)] sm:w-full"
                style={{ color: colors.ink, fontSize: "16px" }}
              />
            </Cellule>

            <Cellule libelle="Prix unitaire HT">
              <input
                value={l.prixUnitaire}
                readOnly={fige}
                inputMode="decimal"
                aria-label={`Prix unitaire ${i + 1}`}
                onChange={(e) => majLigneLocale(l.id, "prixUnitaire", e.target.value)}
                onBlur={() => persisterLigne(l)}
                className="w-24 border-0 bg-transparent p-0 text-right outline-none focus:bg-[rgba(0,0,0,0.03)] sm:w-full"
                style={{ color: colors.ink, fontSize: "16px" }}
              />
            </Cellule>

            <Cellule libelle="Total HT">
              <span className="text-[16px]">{enEuros(montantDeLaLigne(l))}</span>
            </Cellule>

            {!fige && (
              <button
                type="button"
                onClick={() => retirer(l.id)}
                aria-label={`Supprimer la ligne ${i + 1}`}
                className="justify-self-end text-[18px] leading-none"
                style={{ color: colors.muted }}
              >
                ×
              </button>
            )}
          </div>
        ))}

        {!fige && (
          <button type="button" onClick={ajouter} className="mt-4 text-[14px] font-medium" style={{ color: colors.rust }}>
            + Ajouter une ligne
          </button>
        )}
      </section>

      {/* --- Les totaux, alignés à droite comme sur le papier ---------------- */}
      <section className="mt-8 flex justify-end">
        <div className="w-full sm:w-[320px]">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[15px]">Total HT</span>
            <span className="text-[15px]">{enEuros(totalHt)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="flex items-center gap-1 text-[15px]">
              TVA (
              <input
                value={tauxTva}
                readOnly={fige}
                inputMode="decimal"
                aria-label="Taux de TVA"
                onChange={(e) => setTauxTva(e.target.value)}
                onBlur={() => majEnTeteDevisAction(props.devisId, { tauxTva })}
                // Collé au « ( » : aligné à droite dans une boîte fixe, le taux
                // laissait un blanc et se lisait « TVA (    20 %) ».
                className="w-9 border-0 bg-transparent p-0 text-left outline-none focus:bg-[rgba(0,0,0,0.03)]"
                style={{ color: colors.ink, fontSize: "16px" }}
              />
              %)
            </span>
            <span className="text-[15px]">{enEuros(totalTva)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between pt-2.5" style={{ borderTop: `2px solid ${colors.ink}` }}>
            <span className="text-[17px] font-semibold">Total TTC</span>
            <span className="text-[20px] font-semibold" style={{ fontFamily: font.display }}>
              {enEuros(totalHt + totalTva)}
            </span>
          </div>
        </div>
      </section>

      {/* --- Notes, modalités --------------------------------------------- */}
      <section className="mt-9">
        <Intertitre>Notes / conditions</Intertitre>
        <textarea
          value={conditions}
          readOnly={fige}
          rows={2}
          aria-label="Notes et conditions"
          placeholder="Acompte de 30 % à la signature, solde à réception des travaux. Devis gratuit et sans engagement."
          onChange={(e) => setConditions(e.target.value)}
          onBlur={() => majEnTeteDevisAction(props.devisId, { conditionsPaiement: conditions })}
          className="w-full resize-none border-0 bg-transparent p-0 outline-none focus:bg-[rgba(0,0,0,0.03)]"
          style={{ color: colors.ink, fontSize: "16px", lineHeight: 1.5 }}
        />
      </section>

      <section className="mt-7">
        <Intertitre>Modalités de paiement</Intertitre>
        <p className="text-[15px]">Paiement par virement bancaire</p>
        <ChampNu
          valeur={emetteur.iban}
          fige={fige}
          placeholder="IBAN : FR76 …"
          aria="IBAN"
          onChange={(v) => setEmetteur({ ...emetteur, iban: v })}
          onFini={() => majEmetteurAction({ iban: emetteur.iban })}
        />
      </section>

      {/* --- Le pied du document ------------------------------------------- */}
      <footer className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-[46ch] text-[12px] leading-relaxed" style={{ color: colors.muted }}>
          Devis établi par {emetteur.nom || "votre entreprise"}, valable {props.validite}. Bon pour accord précédé de la
          mention manuscrite, daté et signé par le client.
        </p>
        <div className="sm:w-[300px]">
          <div className="h-24 rounded" style={{ border: `1px dashed ${colors.line}` }} aria-hidden="true" />
          <p className="mt-1.5 text-center text-[12px]" style={{ color: colors.muted }}>
            Bon pour accord — signature du client
          </p>
        </div>
      </footer>

      {/* Les seules actions de la page, discrètes, sous le document. */}
      <div className="mt-10 flex flex-col items-center gap-3" style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
        <a
          href={`/api/devis/${props.devisId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="pt-6 text-[14px] font-medium"
          style={{ color: colors.rust }}
        >
          Aperçu du PDF
        </a>
        <a
          href={`/chantiers/${props.chantierId}/export`}
          className="text-[14px] font-medium"
          style={{ color: colors.rust }}
        >
          Envoyer au client →
        </a>
        <p className="pb-1 text-center text-[12px]" style={{ color: colors.muted }}>
          Tout s&apos;enregistre au fur et à mesure. Rien ne part avant que vous ne le décidiez.
        </p>
      </div>
    </article>
  );
}

/** Le montant d'une ligne — quantité × prix unitaire, comme sur le modèle. */
function montantDeLaLigne(l: { quantite: string; prixUnitaire: string }): number {
  return nombre(l.quantite) * nombre(l.prixUnitaire);
}

/**
 * « 3.00 » s'écrit « 3 », « 250.00 » s'écrit « 250 ».
 *
 * La base stocke deux décimales — c'est juste pour de l'argent, et illisible
 * sur un devis : personne n'écrit « 3,00 tilleuls ». Le patron voit donc le
 * nombre tel qu'il l'aurait écrit, et reste libre de taper « 1,5 ».
 */
function sansZerosInutiles(valeur: string): string {
  if (!valeur) return "";
  const n = Number(String(valeur).replace(",", "."));
  if (!Number.isFinite(n)) return valeur;
  return String(n).replace(".", ",");
}

/** Lit un nombre saisi à la française (« 1,5 ») comme à l'anglaise (« 1.5 »). */
function nombre(valeur: string): number {
  const n = Number(String(valeur).replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

/** Une valeur vide vaut le défaut, jamais `NaN` en base. */
function normaliser(valeur: string, defaut: string): string {
  const n = nombre(valeur);
  return valeur.trim() === "" ? defaut : String(n);
}

/**
 * Un champ sans cadre : le devis reste une feuille, pas un formulaire.
 * Il ne se signale qu'au moment où on écrit dedans.
 */
function ChampNu({
  valeur,
  onChange,
  onFini,
  placeholder,
  aria,
  fige,
  grand,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onFini: () => void;
  placeholder: string;
  aria: string;
  fige: boolean;
  grand?: boolean;
}) {
  return (
    <input
      value={valeur}
      readOnly={fige}
      placeholder={placeholder}
      aria-label={aria}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onFini}
      className="block w-full border-0 bg-transparent p-0 py-0.5 outline-none focus:bg-[rgba(0,0,0,0.03)]"
      style={{
        color: colors.ink,
        // 16 px au minimum : en dessous, iOS agrandit la page au premier appui.
        fontSize: grand ? "22px" : "16px",
        fontFamily: grand ? font.display : undefined,
      }}
    />
  );
}

function Intertitre({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: colors.rust }}
    >
      {children}
    </p>
  );
}

function Colonne({ children, droite }: { children: React.ReactNode; droite?: boolean }) {
  return (
    <span
      className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${droite ? "text-right" : ""}`}
      style={{ color: colors.muted }}
    >
      {children}
    </span>
  );
}

/** Sur téléphone, chaque cellule porte son libellé — comme le modèle d'origine. */
function Cellule({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block sm:text-right">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.1em] sm:hidden"
        style={{ color: colors.muted }}
      >
        {libelle}
      </span>
      {children}
    </div>
  );
}

function Reference({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-1"
      style={{ borderBottom: `1px solid ${colors.lineSoft}` }}
    >
      <span className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: colors.muted }}>
        {libelle}
      </span>
      <span className="text-[14px]">{valeur}</span>
    </div>
  );
}
