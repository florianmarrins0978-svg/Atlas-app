/**
 * TOUT EST PRÊT — ce que la porte a rempli, paquet par paquet.
 *
 * **Sa planche du 26 octobre 2026, codée le même jour**
 * (`appli/soignee/creer-un-compte.html`, étape « Tout est prêt »). La fin
 * d'avant disait *« Vos réglages sont remplis. Votre premier devis peut
 * partir. »* sans rien montrer, et Mon entreprise disait juste après le
 * médiateur manquant et obligatoire.
 *
 * **Lu sur l'entreprise ENREGISTRÉE, jamais sur les réponses de la porte** :
 * c'est ce qui partira sur le premier devis qui compte, et un dépôt
 * d'attestation qui a échoué entre-temps doit s'y voir. Les paquets portent les
 * noms de Mon entreprise, dans son ordre.
 *
 * **Une décennale absente n'est pas un manque** : un élagueur n'en a pas
 * forcément, et la porte a demandé Oui ou Non. Ce qui manque, c'est une
 * décennale commencée : un assureur sans adresse, une attestation sans
 * assureur.
 */
import { formeADuCapital } from "@/lib/formes-juridiques";
import { MOYENS_ACCEPTES } from "@/lib/modalites-paiement";
import { afficherTelephone } from "@/lib/telephone";
import { phraseDeCeQuiManque } from "@/lib/creation-compte";

export type EntreprisePourRecap = {
  nom: string;
  formeJuridique: string | null;
  siret: string | null;
  adresse: string | null;
  capitalSocial: string | null;
  villeRcs: string | null;
  regimeTva: "assujettie" | "franchise" | null;
  numeroTva: string | null;
  periodiciteTva: "mensuelle" | "trimestrielle" | null;
  telephone: string | null;
  email: string | null;
  iban: string | null;
  moyensPaiement: string | null;
  assureurDecennale: string | null;
  adresseAssureurDecennale: string | null;
  couvertureDecennale: string | null;
  attestationDeposee: boolean;
  mediateurNom: string | null;
  mediateurCoordonnees: string | null;
  nombreEquipes: number;
};

export type PersonnePourRecap = { prenom: string | null; nom: string | null; email: string };

/** Une ligne : le paquet, ce qu'il porte, et ce qui y manque s'il manque quelque chose. */
export type LigneRecap = {
  paquet: string;
  valeur: string;
  detail: string | null;
  /** « Médiateur à compléter » : dit À LA PLACE de la valeur, en or. */
  manque: string | null;
};

const vide = (v: string | null | undefined) => !v || !v.trim();

/** « FR76 3000 … 0189 » : assez pour le reconnaître, pas assez pour le recopier. */
export function ibanMasque(iban: string): string {
  const groupes = iban.replace(/\s/g, "").toUpperCase().match(/.{1,4}/g) ?? [];
  return groupes.length > 3 ? `${groupes[0]} ${groupes[1]} … ${groupes[groupes.length - 1]}` : groupes.join(" ");
}

function siretLisible(siret: string): string {
  const c = siret.replace(/\D/g, "");
  return c.length === 14 ? `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6, 9)} ${c.slice(9)}` : siret.trim();
}

export function recapitulatifDuCompte(
  e: EntreprisePourRecap,
  personne: PersonnePourRecap
): { lignes: LigneRecap[]; phrase: string | null } {
  const restes: string[] = [];
  /** Le premier manque d'un paquet se dit sur sa ligne ; tous se comptent. */
  const manques = (liste: [boolean, string, string][]): string | null => {
    let premier: string | null = null;
    for (const [manque, nomme, dit] of liste) {
      if (!manque) continue;
      restes.push(nomme);
      premier ??= dit;
    }
    return premier;
  };

  const capital = formeADuCapital(e.formeJuridique);
  const qui = manques([
    [vide(e.siret), "le SIRET", "SIRET à compléter"],
    [vide(e.adresse), "l’adresse", "Adresse à compléter"],
    [capital && vide(e.capitalSocial), "le capital", "Capital à compléter"],
    [capital && vide(e.villeRcs), "la ville du RCS", "Ville du RCS à compléter"],
  ]);

  const assujettie = e.regimeTva !== "franchise";
  const tva = manques([[assujettie && vide(e.numeroTva), "le numéro de TVA", "Numéro de TVA à compléter"]]);

  const joindre = manques([[vide(e.telephone), "le téléphone", "Téléphone à compléter"]]);
  const paye = manques([[vide(e.iban), "l’IBAN", "IBAN à compléter"]]);

  const decennaleCommencee =
    !vide(e.assureurDecennale) || !vide(e.adresseAssureurDecennale) || !vide(e.couvertureDecennale) || e.attestationDeposee;
  const decennale = decennaleCommencee
    ? manques([
        [!e.attestationDeposee, "l’attestation", "Attestation à joindre"],
        [vide(e.assureurDecennale), "l’assureur", "Assureur à compléter"],
        [vide(e.adresseAssureurDecennale), "l’adresse de l’assureur", "Adresse de l’assureur à compléter"],
        [vide(e.couvertureDecennale), "la couverture de la décennale", "Couverture à compléter"],
      ])
    : null;

  const mediateur = manques([[vide(e.mediateurNom), "le médiateur", "Médiateur à compléter"]]);

  const telephone = vide(e.telephone) ? "" : afficherTelephone(e.telephone).affiche;
  const moyens = MOYENS_ACCEPTES.find((m) => m.valeur === e.moyensPaiement)?.titre ?? null;

  const lignes: LigneRecap[] = [
    {
      paquet: "Vous",
      valeur: [personne.prenom, personne.nom].filter(Boolean).join(" "),
      detail: personne.email,
      manque: null,
    },
    {
      paquet: "Qui vous êtes",
      valeur: [e.nom, e.formeJuridique].filter((x) => !vide(x)).join(", "),
      detail: vide(e.siret) ? null : `SIRET ${siretLisible(e.siret!)}`,
      manque: qui,
    },
    {
      paquet: "Votre TVA",
      valeur: assujettie
        ? `Déclarée ${e.periodiciteTva === "trimestrielle" ? "tous les trimestres" : "tous les mois"}`
        : "Franchise, sans TVA",
      detail: assujettie ? e.numeroTva : null,
      manque: tva,
    },
    { paquet: "Vous joindre", valeur: telephone, detail: e.email, manque: joindre },
    { paquet: "Pour être payé", valeur: vide(e.iban) ? "" : ibanMasque(e.iban!), detail: moyens, manque: paye },
    {
      paquet: "Assurance décennale",
      valeur: decennaleCommencee ? (e.assureurDecennale ?? "").trim() : "Aucune",
      detail: e.attestationDeposee ? "Attestation jointe à vos devis" : null,
      manque: decennale,
    },
    {
      paquet: "Médiateur de la consommation",
      valeur: (e.mediateurNom ?? "").trim(),
      detail: e.mediateurCoordonnees,
      manque: mediateur,
    },
    {
      paquet: "Votre équipe",
      valeur: `${e.nombreEquipes} ${e.nombreEquipes > 1 ? "chantiers" : "chantier"} par jour`,
      detail: null,
      manque: null,
    },
  ];

  return { lignes, phrase: phraseDeCeQuiManque(restes) };
}
