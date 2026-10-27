import { enEuros } from "./euros";
import { jourComplet } from "./pour-mon-comptable";

/**
 * L'ATTESTATION DU COMPTABLE — sa planche du 27 octobre 2026
 * (`appli/soignee/comptable-attestation.html`).
 *
 * Sa remarque, après avoir joué le comptable lui-même : *« j'ai coché vert,
 * rouge, et ensuite aucun moyen d'arrêter le document, de le signer »*. Le
 * comptable conclut, se présente, et signe SUR l'attestation : ce qu'il signe
 * est ce qu'il relit.
 *
 * **Une seule règle pour l'écran et pour le PDF.** Le contenu de l'attestation,
 * le texte du tampon et celui du courriel sortent d'ici : l'aperçu que le
 * comptable signe et le fichier rangé chez le patron ne peuvent pas diverger.
 *
 * **Ce que ce document vaut, et ce qu'il ne vaut pas** (dit sur la planche, et
 * écrit au pied du PDF) : une attestation de vérification des justificatifs
 * présentés dans Atlas, signée d'une signature électronique simple. Elle ne
 * remplace pas l'attestation de présentation des comptes, que l'expert-comptable
 * établit dans son logiciel, avec la formule de sa profession.
 */

export type Conclusion = "conforme" | "reserves" | "non_conforme";
export const CONCLUSIONS: readonly Conclusion[] = ["conforme", "reserves", "non_conforme"];

export const MOT_DE_LA_CONCLUSION: Record<Conclusion, string> = {
  conforme: "Conforme",
  reserves: "Conforme avec réserves",
  non_conforme: "Non conforme",
};

/** Ce que chaque conclusion veut dire, sous son mot, au moment de choisir. */
export const SUITE_DE_LA_CONCLUSION: Record<Conclusion, string> = {
  conforme: "Tout est justifié",
  reserves: "Sauf les lignes rejetées",
  non_conforme: "Les justificatifs ne suffisent pas",
};

/** La famille de couleur d'une conclusion : le tampon, la carte de l'accueil, la ligne de Mes dossiers. */
export const TON_DE_LA_CONCLUSION: Record<Conclusion, "vert" | "ambre" | "rouge"> = {
  conforme: "vert",
  reserves: "ambre",
  non_conforme: "rouge",
};

/**
 * Atlas PROPOSE, le comptable choisit : un rejet appelle des réserves, aucun
 * rejet la conformité. « Non conforme » ne se propose jamais : c'est un
 * jugement sur l'ensemble que le compte des lignes ne sait pas porter.
 */
export function conclusionProposee(rejetees: number): Conclusion {
  return rejetees > 0 ? "reserves" : "conforme";
}

export type Fonction = "expert_comptable" | "comptable" | "autre";
export const FONCTIONS: readonly Fonction[] = ["expert_comptable", "comptable", "autre"];
export const NOM_DE_LA_FONCTION: Record<Fonction, string> = {
  expert_comptable: "Expert-comptable",
  comptable: "Comptable",
  autre: "Autre",
};

export type Signataire = {
  nom: string;
  fonction: Fonction;
  societe: string;
  /** Le numéro d'inscription à l'Ordre : l'expert-comptable seul en a un. */
  ordre: string | null;
  siren: string | null;
  adresse: string | null;
  email: string;
  telephone: string | null;
};

export type SaisieLue = { conclusion: Conclusion; observations: string | null; signataire: Signataire };

/** Les bornes de la saisie : ce que la base refuse aussi (migration 0151). */
export const LONGUEURS = { nom: 120, societe: 160, ordre: 40, adresse: 200, email: 200, telephone: 40, observations: 1000 } as const;

function propre(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim().slice(0, max);
  return t === "" ? null : t;
}

/**
 * La saisie du comptable, relue au serveur : il n'a pas de compte, tout ce qui
 * vient de son navigateur est un texte à relire. Le même contrôle sert l'écran
 * (« Continuer » s'allume) et l'action (le refus se dit en mots).
 */
export function lireLaSaisie(brut: {
  conclusion: unknown;
  observations: unknown;
  signataire: Partial<Record<keyof Signataire, unknown>>;
}): { ok: true; valeur: SaisieLue } | { ok: false; raison: string } {
  const conclusion = CONCLUSIONS.find((c) => c === brut.conclusion);
  if (!conclusion) return { ok: false, raison: "Choisissez une conclusion." };
  const s = brut.signataire ?? {};
  const fonction = FONCTIONS.find((f) => f === s.fonction);
  if (!fonction) return { ok: false, raison: "Choisissez votre fonction." };
  const nom = propre(s.nom, LONGUEURS.nom);
  if (!nom || nom.length < 2) return { ok: false, raison: "Votre nom manque." };
  const societe = propre(s.societe, LONGUEURS.societe);
  if (!societe) return { ok: false, raison: "La dénomination sociale manque." };
  const email = propre(s.email, LONGUEURS.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, raison: "Cette adresse e-mail n'est pas lisible." };
  const sirenTape = propre(s.siren, 20);
  const siren = sirenTape ? sirenTape.replace(/\D/g, "") : null;
  if (sirenTape && siren!.length !== 9) return { ok: false, raison: "Le SIREN compte neuf chiffres." };
  return {
    ok: true,
    valeur: {
      conclusion,
      observations: propre(brut.observations, LONGUEURS.observations),
      signataire: {
        nom,
        fonction,
        societe,
        // Un numéro d'Ordre n'a de sens que pour un expert-comptable : il ne
        // s'imprime pas sous « Comptable », même s'il a été tapé avant de changer.
        ordre: fonction === "expert_comptable" ? propre(s.ordre, LONGUEURS.ordre) : null,
        siren: siren ? `${siren.slice(0, 3)} ${siren.slice(3, 6)} ${siren.slice(6)}` : null,
        adresse: propre(s.adresse, LONGUEURS.adresse),
        email,
        telephone: propre(s.telephone, LONGUEURS.telephone),
      },
    },
  };
}

/** Une ligne du dossier telle que l'attestation la compte : son verdict, et pour un rejet sa raison. */
export type LigneAttestee = {
  jour: string;
  libelle: string;
  montant: string;
  sens: "entree" | "sortie";
  verdict: "valide" | "rejete";
  note: string | null;
};

export type ContenuAttestation = {
  titre: string;
  dossier: string;
  periode: string;
  conclusion: Conclusion;
  motConclusion: string;
  comptes: { lignes: number; validees: number; rejetees: number };
  rejets: { jour: string; libelle: string; montant: string; note: string | null }[];
  observations: string | null;
  phrase: string;
  /** Le signataire en lignes : son nom d'abord, puis sa fonction, son cabinet, de quoi le joindre. */
  signataire: string[];
  fait: string;
  pied: string;
  empreinte: string;
};

/** Le jour d'une ligne, comme dans sa liste : « 05/10 ». */
export function jourCourt(jour: string): string {
  return `${jour.slice(8, 10)}/${jour.slice(5, 7)}`;
}

/** Le montant d'une ligne avec son sens, comme sur la page du comptable : « −9,28 € ». */
export function montantSigne(montant: string, sens: "entree" | "sortie"): string {
  return `${sens === "entree" ? "+" : "−"}${enEuros(montant)}`;
}

/** L'empreinte du dossier PDF, en groupes de huit : elle se relit, et se compare à l'œil. */
function enGroupes(empreinte: string): string {
  return (empreinte.match(/.{1,8}/g) ?? []).join(" ");
}

export function lignesDuSignataire(s: Signataire): string[] {
  const fonction = s.fonction === "autre" ? null : NOM_DE_LA_FONCTION[s.fonction];
  return [
    s.nom,
    [fonction, s.ordre ? `Ordre n° ${s.ordre}` : null].filter(Boolean).join(", "),
    [s.societe, s.siren ? `SIREN ${s.siren}` : null].filter(Boolean).join(", "),
    s.adresse ?? "",
    [s.email, s.telephone].filter(Boolean).join(", "),
  ].filter((l) => l !== "");
}

/**
 * Ce que dit l'attestation, mot pour mot. **Les comptes se font ICI, sur les
 * verdicts relus au serveur**, jamais sur ce que l'écran a cru : un navigateur
 * qui annoncerait « 60 validées » ne change rien à ce qui s'imprime.
 */
export function contenuDeLAttestation(d: {
  entreprise: string;
  du: string;
  au: string;
  conclusion: Conclusion;
  observations: string | null;
  lignes: LigneAttestee[];
  signataire: Signataire;
  signeLe: string;
  empreinteDuDossier: string;
}): ContenuAttestation {
  const rejetees = d.lignes.filter((l) => l.verdict === "rejete");
  const n = d.lignes.length;
  return {
    titre: "Attestation de vérification",
    dossier: `Dossier justifié, ${d.entreprise}`,
    periode: `Du ${jourComplet(d.du)} au ${jourComplet(d.au)}`,
    conclusion: d.conclusion,
    motConclusion: MOT_DE_LA_CONCLUSION[d.conclusion],
    comptes: { lignes: n, validees: n - rejetees.length, rejetees: rejetees.length },
    rejets: rejetees.map((l) => ({
      jour: jourCourt(l.jour),
      libelle: l.libelle,
      montant: montantSigne(l.montant, l.sens),
      note: l.note,
    })),
    observations: d.observations,
    phrase:
      n === 1
        ? "J’atteste avoir contrôlé la ligne de ce dossier et son justificatif, tels que présentés dans Atlas."
        : `J’atteste avoir contrôlé les ${n} lignes de ce dossier et leurs justificatifs, tels que présentés dans Atlas.`,
    signataire: lignesDuSignataire(d.signataire),
    fait: `Fait le ${jourComplet(d.signeLe)}`,
    pied: "Cette attestation porte sur les justificatifs présentés dans Atlas. Elle ne certifie pas les comptes.",
    empreinte: `Empreinte du dossier ${enGroupes(d.empreinteDuDossier)}`,
  };
}

/**
 * Le tampon du cabinet : son nom en haut du cercle, la conclusion au centre, la
 * date en bas. Le même pour l'écran (SVG) et pour le PDF.
 */
export function texteDuTampon(conclusion: Conclusion, societe: string, jour: string): { haut: string; centre: string[]; bas: string } {
  const centre = conclusion === "conforme" ? ["CONFORME"] : conclusion === "reserves" ? ["CONFORME", "AVEC RÉSERVES"] : ["NON", "CONFORME"];
  return { haut: societe.toUpperCase(), centre, bas: `LE ${jourComplet(jour).toUpperCase().replace("ᵉʳ", "ER")}` };
}

export type TexteDuTampon = ReturnType<typeof texteDuTampon>;

/**
 * L'attestation vaut-elle encore pour le dossier tel qu'il est ? Non dès qu'un
 * verdict a été posé, ou une ligne justifiée à nouveau, APRÈS la signature :
 * le comptable doit pouvoir signer l'état nouveau, et le patron ne doit pas
 * lire « conforme » sur un dossier qui a bougé depuis.
 */
export function attestationAJour(signeLe: Date, changements: (Date | null)[], complet: boolean): boolean {
  return complet && changements.every((c) => c === null || c.getTime() <= signeLe.getTime());
}

/**
 * Le courriel au patron. **Rien du dossier n'y voyage** : ni une ligne de
 * banque, ni un montant, ni le PDF. Le service d'envoi ne transporte qu'un
 * avis (`src/server/courriel/brevo.ts`) ; l'attestation elle-même reste dans
 * Atlas, rangée avec le dossier, et s'y lit.
 */
export function courrielDeLAttestation(d: { nom: string; societe: string; du: string; au: string; conclusion: Conclusion }): { objet: string; texte: string } {
  const mot = MOT_DE_LA_CONCLUSION[d.conclusion].toLowerCase();
  return {
    objet: `Votre dossier est vérifié : ${mot}`,
    texte:
      `Bonjour,\n\n${d.nom}, ${d.societe}, a vérifié votre dossier justifié du ${jourComplet(d.du)} au ${jourComplet(d.au)} et signé l’attestation : ${mot}.\n\n` +
      "Elle est rangée avec le dossier dans Atlas : Terminés, Pour mon comptable, Mes dossiers justifiés.\n\nAtlas",
  };
}

/** La carte de l'accueil : qui a signé, et ce qui reste à reprendre. */
export function texteDeLaCarte(d: { nom: string; lignes: number; rejetees: number }): string {
  const reprendre = d.rejetees === 0 ? "" : d.rejetees === 1 ? " 1 ligne à reprendre." : ` ${d.rejetees} lignes à reprendre.`;
  return `${d.nom} a vérifié ${d.lignes === 1 ? "la ligne" : `les ${d.lignes} lignes`} du dossier.${reprendre}`;
}
