"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import { adressesDuDocument } from "@/lib/adresses";
import { enEuros } from "@/lib/euros";
import { jourNumerique } from "@/lib/jour";
import LigneRetirable from "@/components/atlas/LigneRetirable";
import NumeroDeDocument from "@/components/atlas/NumeroDeDocument";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import ChoixCivilite from "@/components/atlas/ChoixCivilite";
import type { Civilite } from "@/lib/civilite";
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
  client: { nom: string; civilite: Civilite | null; adresse: string; telephone: string; email: string };
  adresseChantier: string;
  lignesInitiales: Ligne[];
  tauxTva: string;
  conditionsPaiement: string;
  /** La dictée n'a pas été comprise, seulement recopiée — voir `lecture-litterale.ts`. */
  /**
   * Ce que l'agent a retenu des devis passés, par ligne.
   *
   * **Un rappel, jamais un calcul.** `docs/EXEMPLE-DICTEE.md` §9c : l'agent
   * propose le dernier prix comparable en disant d'où il vient, et le patron
   * valide ou corrige d'un geste. La nuance porte tout — un rappel se vérifie
   * d'un coup d'œil, un calcul non sourcé demande qu'on lui fasse confiance.
   *
   * Rien n'est jamais appliqué tout seul : c'est lui qui appuie.
   */
  rappels?: Record<string, { prix: string; phrase: string }>;
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

  // Deux adresses identiques ne s'impriment pas deux fois. Comparaison
  // indulgente : ce sont deux champs saisis à la main, à deux moments
  // différents — une majuscule ou un espace de plus ne font pas une seconde
  // adresse.
  const { chantierSepare } = adressesDuDocument({ clientAdresse: client.adresse, adresseChantier });

  // **Déclaré AVANT les totaux, et ce n'est pas un détail de style** : ils le
  // lisent. Placé après, il produisait un « Cannot access before
  // initialization » que ni `tsc` ni `eslint` ne voient — l'écran répondait 500
  // et rien d'autre ne le disait.
  //
  // Le retrait réversible, comme partout depuis le 10 août 2026. Ici l'enjeu
  // est direct : ces lignes SONT le devis que le client recevra, et une croix
  // nue sans retour possible est le geste le plus coûteux de l'application.
  const retraits = useRetraits({
    valider: async (id) => {
      await retirerLigneAction(id);
      setLignes((cur) => cur.filter((l) => l.id !== id));
    },
  });

  // Les totaux se recalculent sous ses yeux, à chaque frappe : un devis dont le
  // total n'apparaît qu'après enregistrement se relit deux fois.
  //
  // **Ils suivent ce qui reste.** Un total qui ne bouge pas après un
  // retrait fait douter que le retrait ait eu lieu — et ici il ferait douter du
  // montant même du devis.
  const lignesVisibles = lignes.filter((l) => !retraits.estRetire(l.id));
  const totalHt = lignesVisibles.reduce((somme, l) => somme + montantDeLaLigne(l), 0);
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

  /**
   * Reprend le prix rappelé — d'un geste, et sans rien décider à sa place.
   *
   * L'état local est mis à jour **avant** l'enregistrement pour que le chiffre
   * apparaisse à l'instant où il appuie : sur un téléphone, une valeur qui met
   * une seconde à s'afficher se lit comme un bouton qui n'a pas marché, et il
   * appuie une seconde fois.
   */
  async function reprendreRappel(l: Ligne, prix: string) {
    majLigneLocale(l.id, "prixUnitaire", prix);
    await majLigneAction(l.id, {
      libelle: l.libelle,
      quantite: normaliser(l.quantite, "1"),
      prixUnitaire: prix,
    });
  }

  async function ajouter() {
    const creee = await ajouterLigneAction(props.chantierId);
    setLignes((cur) => [...cur, { id: creee.id, libelle: "", quantite: "1", prixUnitaire: "", montant: "0.00" }]);
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

      {/* **Le message EST la porte — et ce n'était pas le cas.**
          Le patron, le 13 août 2026, capture à l'appui : *« le message dit de
          consulter la case devis mais aucune case devis existe »*. Il avait
          raison sur le fond : l'écran Devis existe bien
          (`/chantiers/[id]/export`), mais il vit dans le tiroir de la fiche —
          **aucune porte n'y menait d'ici**, et la phrase décrivait donc un
          itinéraire à reconstituer seul.

          Pire : deux écrans s'appellent « Devis » de son point de vue — celui
          qu'il regarde, et celui où l'on corrige. « Ouvrez l'écran Devis »
          était donc introuvable ET ambigu.

          Il a choisi la proposition A de
          `docs/maquettes/40-le-message-du-devis-fige.html` : la phrase dit
          pourquoi c'est figé, la ligne dessous y emmène. Quatre lignes
          deviennent deux, et le mot « écran Devis » disparaît.

          **Le message reste**, et c'était l'autre branche de sa question. Cet
          écran est celui où l'on RÉDIGE : le jour où il touche un prix, sans
          cette phrase il ne se passerait rien et rien ne dirait pourquoi. */}
      {fige && (
        <div className="mb-6 rounded-lg px-4 py-3" style={{ backgroundColor: colors.rustTint, color: colors.rust }}>
          <p className="text-[13px]">Ce devis est parti chez votre client : il ne se modifie plus.</p>
          <Link
            href={`/chantiers/${props.chantierId}/export`}
            className="mt-2 block text-[13px] font-semibold"
            style={{ color: colors.rust }}
          >
            Le corriger et le renvoyer →
          </Link>
        </div>
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
          <Reference libelle="Devis n°" valeur={<NumeroDeDocument valeur={props.numeroCommercial} />} />
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
          <ChampNu long valeur={emetteur.adresse} fige={fige} placeholder="Adresse du siège social" aria="Adresse de l'entreprise"
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
              {/* **La civilité, au-dessus du nom** — le même geste qu'à la
                  création (`ChoixCivilite`). C'est ici qu'il corrige un client
                  d'avant le 13 août 2026, ou une pastille oubliée : sans cette
                  seconde porte, une cliente saisie « Roux » resterait
                  « Mr. Roux » pour toujours, y compris dans le message qui
                  part chez elle. */}
              <ChoixCivilite
                valeur={client.civilite}
                fige={fige}
                sansLegende
                onChange={(v) => {
                  setClient({ ...client, civilite: v });
                  // Enregistré sur-le-champ : une pastille n'a pas de « fin de
                  // frappe » où se raccrocher, contrairement aux champs.
                  void majClientDuDevisAction(props.clientId!, { civilite: v });
                }}
              />
              <ChampNu valeur={client.nom} fige={fige} placeholder="Nom complet" aria="Nom du client"
                onChange={(v) => setClient({ ...client, nom: v })}
                onFini={() => majClientDuDevisAction(props.clientId!, { nom: client.nom })} />
              {/* **L'ordre est celui d'une lettre, et le patron l'a demandé
                  ainsi le 6 août 2026 : « le numéro de téléphone devrait être
                  en dernier ».** C'est aussi l'ordre du modèle d'Arborea — on
                  lit d'abord à qui on écrit et où il habite, la façon de le
                  joindre vient après. */}
              <ChampNu long valeur={client.adresse} fige={fige} placeholder="Adresse" aria="Adresse du client"
                onChange={(v) => setClient({ ...client, adresse: v })}
                onFini={() => majClientDuDevisAction(props.clientId!, { adresse: client.adresse })} />
              <ChampNu valeur={client.email} fige={fige} placeholder="E-mail" aria="E-mail du client"
                onChange={(v) => setClient({ ...client, email: v })}
                onFini={() => majClientDuDevisAction(props.clientId!, { email: client.email })} />
              <ChampNu valeur={client.telephone} fige={fige} placeholder="Téléphone" aria="Téléphone du client"
                onChange={(v) => setClient({ ...client, telephone: v })}
                onFini={() => majClientDuDevisAction(props.clientId!, { telephone: client.telephone })} />
            </>
          ) : (
            <p className="text-[13px]" style={{ color: colors.muted }}>
              Aucun client rattaché à ce chantier.
            </p>
          )}
          {/* **L'adresse des travaux ne s'affiche que si elle diffère.**
              Sinon elle réapparaissait plus bas, sans étiquette, comme une
              seconde adresse surgie de nulle part — c'est ce que le patron a
              vu : « l'adresse n'est pas au bon endroit ». Quand elle diffère,
              elle porte son titre, parce qu'une adresse nue sur un devis ne
              dit pas de quoi elle est l'adresse. */}
          {(chantierSepare !== null || !props.clientId) && (
            <div style={{ marginTop: props.clientId ? 14 : 0 }}>
              <Intertitre>Chantier</Intertitre>
              <ChampNu long valeur={adresseChantier} fige={fige} placeholder="Adresse des travaux" aria="Adresse du chantier"
                onChange={setAdresseChantier}
                onFini={() => majAdresseChantierAction(props.chantierId, adresseChantier)} />
            </div>
          )}
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

        {lignesVisibles.length === 0 && (
          <p className="py-4 text-[13px]" style={{ color: colors.muted }}>
            Aucune ligne pour l&apos;instant.
          </p>
        )}

        {lignes.map((l, i) => (
          <LigneRetirable
            key={l.id}
            libelle={l.libelle ? `« ${l.libelle.split("\n")[0]} »` : `la ligne ${i + 1}`}
            retiree={retraits.estRetire(l.id)}
            onRetirer={() =>
              retraits.retirer(l.id, l.libelle ? `« ${l.libelle.split("\n")[0]} »` : `la ligne ${i + 1}`)
            }
            // Une ligne de devis porte un libellé sur plusieurs lignes, une
            // quantité, un prix : elle monte bien au-delà des 170 px par défaut,
            // et l'enveloppe la tronquerait au repos.
            hauteurMax={420}
            className="flex"
          >
          <div
            className="grid w-full gap-2 py-3 sm:grid-cols-[1fr_70px_130px_130px] sm:items-start sm:gap-3"
            style={{ borderBottom: `1px solid ${colors.lineSoft}` }}
          >
            {/* La ligne principale réunit plusieurs travaux, un par ligne
                (« abattage / broyage / évacuation »). Compter les retours à la
                ligne ne suffisait pas : un seul travail au libellé long en
                occupe deux à l'écran. Voir `ZoneQuiGrandit`. */}
            <ZoneQuiGrandit
              valeur={l.libelle}
              fige={fige}
              aria={`Description ${i + 1}`}
              placeholder="Ex : Élagage d'un tilleul — taille architecturée"
              onChange={(v) => majLigneLocale(l.id, "libelle", v)}
              onFini={() => persisterLigne(l)}
              className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none focus:bg-[rgba(0,0,0,0.03)]"
              style={{ color: colors.ink, fontSize: "16px", lineHeight: 1.45 }}
            />

            <Cellule libelle="Qté">
              <ChiffreSaisi
                valeur={l.quantite}
                fige={fige}
                aria={`Quantité ${i + 1}`}
                placeholder="1"
                onChange={(v) => majLigneLocale(l.id, "quantite", v)}
                onFini={() => persisterLigne(l)}
              />
            </Cellule>

            <Cellule libelle="Prix unitaire HT">
              <ChiffreSaisi
                valeur={l.prixUnitaire}
                fige={fige}
                aria={`Prix unitaire ${i + 1}`}
                placeholder="0,00"
                onChange={(v) => majLigneLocale(l.id, "prixUnitaire", v)}
                onFini={() => persisterLigne(l)}
              />
            </Cellule>

            <Cellule libelle="Total HT">
              <span className="text-[16px]">{enEuros(montantDeLaLigne(l))}</span>
            </Cellule>

            {/* Ce que l'agent a retenu la dernière fois, sur un travail
                comparable. Discret et sous la ligne : c'est un rappel, pas une
                consigne — il regarde s'il veut, il ignore s'il sait mieux. */}
            {!fige && props.rappels?.[l.id] && (
              <div className="sm:col-span-5" style={{ marginTop: -4, marginBottom: 6 }}>
                <span className="text-[12px] leading-snug" style={{ color: colors.muted }}>
                  {props.rappels[l.id]!.phrase}{" "}
                </span>
                <button
                  type="button"
                  onClick={() => reprendreRappel(l, props.rappels![l.id]!.prix)}
                  className="text-[12px] font-medium underline"
                  style={{ color: colors.rust }}
                >
                  Reprendre ce prix
                </button>
              </div>
            )}

          </div>
          </LigneRetirable>
        ))}

        {!fige && (
          <button type="button" onClick={ajouter} className="mt-4 text-[14px] font-medium" style={{ color: colors.rust }}>
            + Ajouter une ligne
          </button>
        )}

        <TiroirDesRetires
          dernier={retraits.dernier}
          nombre={retraits.nombre}
          onAnnuler={retraits.annuler}
          className="mt-4 !mx-0"
        />
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
        <ZoneQuiGrandit
          valeur={conditions}
          fige={fige}
          aria="Notes et conditions"
          placeholder="Acompte de 30 % à la signature, solde à réception des travaux. Devis gratuit et sans engagement."
          onChange={setConditions}
          onFini={() => majEnTeteDevisAction(props.devisId, { conditionsPaiement: conditions })}
          className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none focus:bg-[rgba(0,0,0,0.03)]"
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
 * Une zone de texte HAUTE DE CE QU'ELLE CONTIENT — jamais de ce qu'on estime.
 *
 * **Les trois zones du devis estimaient leur hauteur, et les trois estimaient
 * mal.** L'adresse comptait les caractères (`ceil(longueur / 34)`), la
 * description comptait les retours à la ligne, les conditions ne comptaient
 * rien du tout (`rows={2}`). Or un texte ne se coupe ni au caractère ni au
 * retour à la ligne : il se coupe au mot, quand il touche le bord. Deux lignes
 * estimées en font trois à l'écran, la zone se met à défiler, et le patron
 * relit un devis amputé du bas.
 *
 * C'est très exactement le défaut que la zone d'adresse existait pour
 * corriger — *« le patron lit une adresse amputée sur son propre devis »* —
 * revenu par une autre porte.
 *
 * **Trouvé le 11 août 2026 par le balayage des barres de défilement**, qui
 * cherchait tout autre chose. La barre grise était le symptôme ; le texte caché
 * était le défaut. La masquer aurait rendu la coupure silencieuse — c'eût été
 * le pire des deux.
 *
 * On mesure donc au lieu d'estimer. `scrollHeight` donne la hauteur réelle une
 * fois le texte reporté à la ligne. La remise à `auto` avant de lire est
 * indispensable : sans elle la hauteur ne redescend jamais quand on efface.
 */
function ZoneQuiGrandit({
  valeur,
  onChange,
  onFini,
  placeholder,
  aria,
  fige,
  className,
  style,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onFini: () => void;
  placeholder: string;
  aria: string;
  fige: boolean;
  className: string;
  style: React.CSSProperties;
}) {
  const zone = useRef<HTMLTextAreaElement>(null);

  // À chaque frappe ET au premier rendu : le contenu vient du serveur, il est
  // déjà long avant qu'on ait touché quoi que ce soit.
  //
  // `useLayoutEffect` et non `useEffect` : la mesure doit être posée avant que
  // le navigateur peigne, sinon la feuille sursaute au chargement.
  useLayoutEffect(() => {
    const el = zone.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [valeur]);

  return (
    <textarea
      ref={zone}
      value={valeur}
      readOnly={fige}
      placeholder={placeholder}
      aria-label={aria}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onFini}
      className={className}
      style={style}
    />
  );
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
  long,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onFini: () => void;
  placeholder: string;
  aria: string;
  fige: boolean;
  grand?: boolean;
  /**
   * Passe à plusieurs lignes plutôt que de couper. Réservé aux adresses : dans
   * un `<input>`, « 10 rue Denfert-Rochereau 78200 Mantes-la-Jolie » s'arrête
   * au bord de l'écran, et le patron lit une adresse amputée sur son propre
   * devis. Le PDF, lui, la reporte à la ligne depuis toujours — l'écran devait
   * dire la même chose que le papier.
   */
  long?: boolean;
}) {
  if (long) {
    return (
      <ZoneQuiGrandit
        valeur={valeur}
        onChange={onChange}
        onFini={onFini}
        placeholder={placeholder}
        aria={aria}
        fige={fige}
        className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 py-0.5 outline-none focus:bg-[rgba(0,0,0,0.03)]"
        style={{ color: colors.ink, fontSize: "16px", lineHeight: 1.4 }}
      />
    );
  }
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
/**
 * Un chiffre qu'on saisit — et qu'on VOIT qu'on peut saisir.
 *
 * Le 6 août 2026, le patron : « quand j'essaye de cliquer pour mettre un prix,
 * ce n'est pas cliquable ». Il l'était pourtant. Mais le champ était vide, sans
 * repère, sans placeholder, et haut de 24 pixels dans un coin de l'écran —
 * mesuré : 96 × 24. Apple recommande 44 pixels pour une cible tactile, et un
 * champ invisible n'invite personne à le toucher. Un contrôle automatique
 * répondait « éditable : oui » et n'y voyait donc rien.
 *
 * D'où les trois changements, tous nécessaires ensemble : une hauteur de doigt,
 * un trait sous le champ tant qu'il est vide, et un exemple en gris. Le trait
 * disparaît dès qu'un chiffre est écrit — sur le papier, un devis rempli n'a
 * pas de cases.
 */
function ChiffreSaisi({
  valeur,
  onChange,
  onFini,
  placeholder,
  aria,
  fige,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onFini: () => void;
  placeholder: string;
  aria: string;
  fige: boolean;
}) {
  const vide = valeur.trim() === "";
  return (
    <input
      value={valeur}
      readOnly={fige}
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={aria}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onFini}
      className="w-24 border-0 bg-transparent px-1 text-right outline-none focus:bg-[rgba(0,0,0,0.03)] sm:w-full"
      style={{
        color: colors.ink,
        fontSize: "16px",
        minHeight: 44,
        borderBottom: vide && !fige ? `1px solid ${colors.lineSoft}` : "1px solid transparent",
      }}
    />
  );
}

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

function Reference({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
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
