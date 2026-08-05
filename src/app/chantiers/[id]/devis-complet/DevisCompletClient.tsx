"use client";

import { useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
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

// **Le devis, en entier.**
//
// Le patron, le 5 août 2026 : « je veux que lorsqu'on clique sur rédiger à la
// main, ça ouvre le fichier devis, le vrai ! Le fichier en entier, pas juste
// les lignes pour remplir les infos et les prix. »
//
// Il avait raison sur le fond : l'écran Prix ne montrait que des lignes et des
// montants. Or ce qu'il envoie à son client, c'est un **document** — son
// en-tête, ses coordonnées, celles du client, le tableau, les totaux, ses
// conditions, le cadre de signature. Écrire un devis à la main, c'est écrire ce
// document-là, pas remplir un tableur.
//
// Cette page reprend `appli/devis-modele.html` — le modèle qu'il avait
// construit lui-même pour Arborea — champ pour champ et dans le même ordre.
// C'est aussi celui que reproduit le PDF (`ARCHITECTURE.md` §16) : ce qu'il
// voit ici est ce que son client recevra.
//
// **Ce qui change par rapport au modèle d'origine.** Celui-ci gardait tout dans
// le navigateur (`localStorage`). Ici chaque champ part vers SA source — son
// entreprise, la fiche du client, le chantier, les lignes de prix — de sorte
// que la facture de fin de chantier et le relevé de TVA continuent d'en
// découler. Un beau document dont Atlas ne saurait rien serait une impasse.

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
};

export default function DevisCompletClient(props: Props) {
  const fige = props.statut === "envoye";

  const [emetteur, setEmetteur] = useState(props.emetteur);
  const [client, setClient] = useState(props.client);
  const [adresseChantier, setAdresseChantier] = useState(props.adresseChantier);
  const [lignes, setLignes] = useState<Ligne[]>(props.lignesInitiales);
  const [tauxTva, setTauxTva] = useState(props.tauxTva);
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
    setLignes((cur) => [
      ...cur,
      { id: creee.id, libelle: "", quantite: "1", prixUnitaire: "0.00", montant: "0.00" },
    ]);
  }

  async function retirer(id: string) {
    setLignes((cur) => cur.filter((l) => l.id !== id));
    await retirerLigneAction(id);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 pb-24 pt-6">
      {fige && (
        <p className="rounded-2xl px-4 py-3 text-[13px]" style={{ backgroundColor: colors.rustTint, color: colors.rust }}>
          Ce devis est parti chez votre client : il ne se modifie plus. Pour le corriger, ouvrez l&apos;écran Devis et
          choisissez « Corriger et renvoyer » — votre client recevra une nouvelle version, et l&apos;ancienne reste
          comme trace de ce qui avait été proposé.
        </p>
      )}

      {/* --- En-tête : l'émetteur et les références, comme sur le papier --- */}
      <section className="rounded-2xl p-5" style={{ backgroundColor: colors.card }}>
        <div className="flex flex-col gap-4">
          <div>
            <span className={smallCaps} style={{ color: colors.muted }}>
              Émetteur
            </span>
            <Champ label="Nom de l'entreprise" valeur={emetteur.nom} fige={fige}
              onChange={(v) => setEmetteur({ ...emetteur, nom: v })}
              onFini={() => majEmetteurAction({ nom: emetteur.nom })} />
            <Champ label="Adresse" valeur={emetteur.adresse} fige={fige} placeholder="Adresse du siège social"
              onChange={(v) => setEmetteur({ ...emetteur, adresse: v })}
              onFini={() => majEmetteurAction({ adresse: emetteur.adresse })} />
            <Champ label="Téléphone" valeur={emetteur.telephone} fige={fige} placeholder="06 12 34 56 78"
              onChange={(v) => setEmetteur({ ...emetteur, telephone: v })}
              onFini={() => majEmetteurAction({ telephone: emetteur.telephone })} />
            <Champ label="E-mail" valeur={emetteur.email} fige={fige} placeholder="contact@exemple.fr"
              onChange={(v) => setEmetteur({ ...emetteur, email: v })}
              onFini={() => majEmetteurAction({ email: emetteur.email })} />
            <Champ label="SIREN / SIRET" valeur={emetteur.siret} fige={fige} placeholder="N° SIREN / SIRET"
              onChange={(v) => setEmetteur({ ...emetteur, siret: v })}
              onFini={() => majEmetteurAction({ siret: emetteur.siret })} />
            {/* Sans IBAN, le client reçoit un devis qu'il ne peut pas payer :
                le modèle du patron l'imprime, et aucun écran ne le demandait. */}
            <Champ label="IBAN" valeur={emetteur.iban} fige={fige} placeholder="FR76 …"
              onChange={(v) => setEmetteur({ ...emetteur, iban: v })}
              onFini={() => majEmetteurAction({ iban: emetteur.iban })} />
          </div>

          <div style={{ borderTop: `1px solid ${colors.line}` }} className="pt-4">
            <Reference libelle="Devis n°" valeur={props.numeroCommercial} />
            <Reference libelle="Date" valeur={jourNumerique(props.dateEmission)} />
            <Reference libelle="Validité" valeur={props.validite} />
          </div>
        </div>
      </section>

      <h1 className="text-center text-[28px]" style={{ fontFamily: font.display }}>
        Devis
      </h1>

      {/* --- Le client, et où se fait le chantier --- */}
      <section className="rounded-2xl p-5" style={{ backgroundColor: colors.card }}>
        <span className={smallCaps} style={{ color: colors.muted }}>
          Client
        </span>
        {props.clientId ? (
          <>
            <Champ label="Nom complet" valeur={client.nom} fige={fige} placeholder="M. Bernard"
              onChange={(v) => setClient({ ...client, nom: v })}
              onFini={() => majClientDuDevisAction(props.clientId!, { nom: client.nom })} />
            <Champ label="Adresse" valeur={client.adresse} fige={fige} placeholder="12 rue des Lilas, Nantes"
              onChange={(v) => setClient({ ...client, adresse: v })}
              onFini={() => majClientDuDevisAction(props.clientId!, { adresse: client.adresse })} />
            <Champ label="Téléphone" valeur={client.telephone} fige={fige} placeholder="06 12 34 56 78"
              onChange={(v) => setClient({ ...client, telephone: v })}
              onFini={() => majClientDuDevisAction(props.clientId!, { telephone: client.telephone })} />
            <Champ label="E-mail" valeur={client.email} fige={fige} placeholder="client@exemple.fr"
              onChange={(v) => setClient({ ...client, email: v })}
              onFini={() => majClientDuDevisAction(props.clientId!, { email: client.email })} />
          </>
        ) : (
          <p className="mt-2 text-[13px]" style={{ color: colors.muted }}>
            Aucun client n&apos;est rattaché à ce chantier. Le devis peut s&apos;écrire quand même, mais il partira
            sans destinataire.
          </p>
        )}
        <Champ label="Adresse du chantier" valeur={adresseChantier} fige={fige} placeholder="Si différente"
          onChange={setAdresseChantier}
          onFini={() => majAdresseChantierAction(props.chantierId, adresseChantier)} />
      </section>

      {/* --- Le tableau : description, quantité, prix unitaire, total --- */}
      <section className="rounded-2xl p-5" style={{ backgroundColor: colors.card }}>
        <span className={smallCaps} style={{ color: colors.muted }}>
          Détail des prestations
        </span>

        <div className="mt-3 flex flex-col gap-4">
          {lignes.length === 0 && (
            <p className="text-[13px]" style={{ color: colors.muted }}>
              Aucune ligne : ce devis partirait à 0,00 €.
            </p>
          )}
          {lignes.map((l, i) => (
            <div key={l.id} className="flex flex-col gap-2 rounded-xl p-3" style={{ backgroundColor: colors.cream }}>
              <textarea
                value={l.libelle}
                readOnly={fige}
                rows={2}
                aria-label={`Description ${i + 1}`}
                placeholder="Ex : Élagage d'un tilleul — taille architecturée"
                onChange={(e) => majLigneLocale(l.id, "libelle", e.target.value)}
                onBlur={() => persisterLigne(l)}
                className="w-full resize-none rounded-lg border-0 px-3 py-2 outline-none"
                style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
              />
              {/* Deux colonnes, pas trois : sur un écran de six pouces,
                  « Prix unitaire HT » passait à la ligne et décalait son champ
                  d'un cran par rapport à « Qté ». Le total de la ligne prend sa
                  propre ligne, aligné à droite comme sur le papier. */}
              <div className="grid grid-cols-2 gap-2">
                <PetitChamp label="Qté" valeur={l.quantite} fige={fige} aria={`Quantité ${i + 1}`}
                  onChange={(v) => majLigneLocale(l.id, "quantite", v)} onFini={() => persisterLigne(l)} />
                <PetitChamp label="Prix unitaire HT" valeur={l.prixUnitaire} fige={fige} aria={`Prix unitaire ${i + 1}`}
                  onChange={(v) => majLigneLocale(l.id, "prixUnitaire", v)} onFini={() => persisterLigne(l)} />
              </div>
              <div className="flex items-baseline justify-between">
                <span className={smallCaps} style={{ color: colors.muted }}>
                  Total HT
                </span>
                <span className="text-[16px]" style={{ color: colors.ink }}>
                  {enEuros(montantDeLaLigne(l))}
                </span>
              </div>
              {!fige && (
                <button
                  type="button"
                  onClick={() => retirer(l.id)}
                  aria-label={`Supprimer la ligne ${i + 1}`}
                  className="self-end text-[13px]"
                  style={{ color: colors.muted }}
                >
                  Supprimer
                </button>
              )}
            </div>
          ))}
        </div>

        {!fige && (
          <button type="button" onClick={ajouter} className="mt-3 text-[14px] font-medium" style={{ color: colors.rust }}>
            + Ajouter une ligne
          </button>
        )}
      </section>

      {/* --- Les totaux, avec le taux de TVA que le patron décide --- */}
      <section className="rounded-2xl p-5" style={{ backgroundColor: colors.card }}>
        <LigneTotal libelle="Total HT" valeur={enEuros(totalHt)} />
        <div className="flex items-center justify-between py-2">
          <span className="flex items-center gap-2 text-[15px]">
            TVA
            <input
              value={tauxTva}
              readOnly={fige}
              inputMode="decimal"
              aria-label="Taux de TVA"
              onChange={(e) => setTauxTva(e.target.value)}
              onBlur={() => majEnTeteDevisAction(props.devisId, { tauxTva: tauxTva })}
              className="w-16 rounded-lg border-0 px-2 py-1 text-center outline-none"
              style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
            />
            %
          </span>
          <span className="text-[15px]">{enEuros(totalTva)}</span>
        </div>
        <div style={{ borderTop: `1px solid ${colors.line}` }} className="pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-medium">Total TTC</span>
            <span className="text-[22px]" style={{ fontFamily: font.display, color: colors.rust }}>
              {enEuros(totalHt + totalTva)}
            </span>
          </div>
        </div>
      </section>

      {/* --- Notes et conditions, imprimées au bas du document --- */}
      <section className="rounded-2xl p-5" style={{ backgroundColor: colors.card }}>
        <span className={smallCaps} style={{ color: colors.muted }}>
          Notes / conditions
        </span>
        <textarea
          value={conditions}
          readOnly={fige}
          rows={3}
          aria-label="Notes et conditions"
          placeholder="Acompte de 30 % à la signature, solde à réception des travaux. Devis gratuit et sans engagement."
          onChange={(e) => setConditions(e.target.value)}
          onBlur={() => majEnTeteDevisAction(props.devisId, { conditionsPaiement: conditions })}
          className="mt-2 w-full resize-none rounded-xl border-0 px-3 py-2 outline-none"
          style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
        />
        <p className="mt-2 text-[12px]" style={{ color: colors.muted }}>
          Vos modalités de paiement sont reprises de votre IBAN, ci-dessus.
        </p>
      </section>

      {/* --- Le pied du document, tel qu'il s'imprime --- */}
      <section className="rounded-2xl p-5" style={{ backgroundColor: colors.card }}>
        <p className="text-[12px] leading-relaxed" style={{ color: colors.muted }}>
          Devis établi par {emetteur.nom || "votre entreprise"}, valable {props.validite}. Bon pour accord précédé de
          la mention manuscrite, daté et signé par le client.
        </p>
        <div
          className="mt-4 h-20 rounded-lg"
          style={{ border: `1px dashed ${colors.line}` }}
          aria-hidden="true"
        />
        <p className="mt-2 text-center text-[12px]" style={{ color: colors.muted }}>
          Bon pour accord — signature du client
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <a
          href={`/api/devis/${props.devisId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[14px] font-medium"
          style={{ color: colors.rust }}
        >
          Aperçu du PDF
        </a>
        <a
          href={`/chantiers/${props.chantierId}/export`}
          className="block w-full rounded-2xl py-3.5 text-center text-[15px] font-medium text-white"
          style={{ backgroundColor: colors.rust }}
        >
          Terminé — aller à l&apos;envoi
        </a>
        <p className="text-center text-[12px]" style={{ color: colors.muted }}>
          Tout est enregistré au fur et à mesure. Rien ne part au client avant que vous ne le décidiez.
        </p>
      </div>
    </div>
  );
}

/** Le montant d'une ligne — quantité × prix unitaire, comme sur le modèle. */
function montantDeLaLigne(l: { quantite: string; prixUnitaire: string }): number {
  return nombre(l.quantite) * nombre(l.prixUnitaire);
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

function Champ({
  label,
  valeur,
  onChange,
  onFini,
  placeholder,
  fige,
}: {
  label: string;
  valeur: string;
  onChange: (v: string) => void;
  onFini: () => void;
  placeholder?: string;
  fige: boolean;
}) {
  return (
    <label className="mt-3 flex flex-col gap-1">
      <span className={smallCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      <input
        value={valeur}
        readOnly={fige}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onFini}
        className="rounded-xl border-0 px-3 py-2.5 outline-none"
        // 16 px : en dessous, iOS agrandit la page au premier appui dans le champ.
        style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
      />
    </label>
  );
}

function PetitChamp({
  label,
  valeur,
  onChange,
  onFini,
  aria,
  fige,
}: {
  label: string;
  valeur: string;
  onChange: (v: string) => void;
  onFini: () => void;
  aria: string;
  fige: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={smallCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      <input
        value={valeur}
        readOnly={fige}
        inputMode="decimal"
        aria-label={aria}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onFini}
        className="rounded-lg border-0 px-2 py-2 outline-none"
        style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
      />
    </label>
  );
}

function Reference({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-[13px]" style={{ color: colors.muted }}>
        {libelle}
      </span>
      <span className="text-[14px]">{valeur}</span>
    </div>
  );
}

function LigneTotal({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[15px]">{libelle}</span>
      <span className="text-[15px]">{valeur}</span>
    </div>
  );
}
