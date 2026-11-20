/**
 * Les fiches de chantier : ce que le serveur rendrait, sans serveur.
 *
 * Sa demande du 20 novembre 2026, « pareil avec les autres outils » : la
 * liste des fiches, « Composer ma fiche », une fiche qu'on remplit, son envoi,
 * et le compte rendu que reçoit le client. La base est remplacée par un petit
 * carnet en mémoire, qui repart à zéro quand on recommence :
 *   · les prestations sont le MODÈLE FOURNI par l'appli (MODELE_FOURNI,
 *     src/lib/prestations-entretien.ts), celui d'un compte neuf ;
 *   · deux clients d'exemple, M. Bernard et M. Lemaire ;
 *   · un compte rendu déjà envoyé chez M. Bernard, le jeudi 29 octobre :
 *     c'est lui que « comme la dernière fois » reprend quand on nomme
 *     M. Bernard sur une fiche neuve, par la fonction même de l'appli
 *     (`cocherCommeLaDerniereFois`).
 * Rien ne part : à l'envoi, l'écran ouvrirait la messagerie de l'artisan ;
 * ici la page dit ce qui s'ouvrirait.
 */
import { MODELE_FOURNI, modeleManquant } from "@/lib/prestations-entretien";
import { cocherCommeLaDerniereFois, type LignePassage } from "@/lib/passage-entretien";
import { naviguer } from "../routeur";
import { fabrique, type Action } from "./commun";

type Ligne = LignePassage & { id: string };
type Fiche = {
  id: string;
  jour: string;
  clientId: string | null;
  minutes: number | null;
  tempsVisible: boolean;
  observations: string | null;
  envoyeLe: Date | null;
  jeton: string | null;
  signaturePng: string | null;
  signeeLe: Date | null;
  lignes: Ligne[];
};

let compteur = 0;
const nouvelId = (prefixe: string) => `${prefixe}-${++compteur}`;

const CLIENTS = [
  { id: "bernard", nom: "Bernard", civilite: "mr", telephone: "06 39 98 45 67", email: null, adresse: "8 rue des Tilleuls, Valmorin", canalCommunication: "sms" },
  { id: "lemaire", nom: "Lemaire", civilite: "mr", telephone: "06 39 98 12 34", email: null, adresse: "12 allée des Charmilles, Valmorin", canalCommunication: "sms" },
];
const ENTREPRISE = { nom: "Les Jardins de Valmorin", messageClientPassage: null };

const prestations = MODELE_FOURNI.map((m, ordre) => ({ id: nouvelId("prestation"), famille: m.famille, libelle: m.libelle, ordre }));
const lignesDuModele = (faites: string[] = []): Ligne[] =>
  prestations.map((p) => ({ id: nouvelId("ligne"), famille: p.famille, libelle: p.libelle, ordre: p.ordre, faite: faites.includes(p.libelle) }));

const fiches: Fiche[] = [
  {
    id: "passage-bernard",
    jour: "2026-10-29",
    clientId: "bernard",
    minutes: 150,
    tempsVisible: true,
    observations: "Le massif du fond manque d’eau : pensez à arroser le soir si la semaine reste sèche.",
    envoyeLe: new Date("2026-10-29T17:42:00+01:00"),
    jeton: "rapport-bernard",
    signaturePng: null,
    signeeLe: null,
    lignes: lignesDuModele(["Tonte et ébarbage", "Bordures massifs", "Désherbage massifs", "Ramassage des feuilles", "Évacuation des déchets"]),
  },
];

const client = (id: string | null) => CLIENTS.find((c) => c.id === id) ?? null;
const trouver = (id: string) => fiches.find((f) => f.id === id) ?? null;
const ok = { ok: true };
const introuvable = { ok: false, phrase: "Cette fiche n’existe plus." };

/** La fiche telle que `lirePassage` la rend : le client lu sur sa fiche. */
function passage(f: Fiche) {
  const c = client(f.clientId);
  return {
    ...f,
    clientNom: c?.nom ?? null,
    clientTelephone: c?.telephone ?? null,
    clientEmail: c?.email ?? null,
    clientCivilite: c?.civilite ?? null,
    clientCanal: (c?.canalCommunication as "sms" | "email" | undefined) ?? null,
    lignes: [...f.lignes].sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle)),
  };
}

export const { bouchon, constante } = fabrique({
  "src/app/paysage/fiche/actions.ts": {
    ouvrirFicheAction: async (jour) => {
      const f: Fiche = { id: nouvelId("passage"), jour: String(jour), clientId: null, minutes: null, tempsVisible: true, observations: null, envoyeLe: null, jeton: null, signaturePng: null, signeeLe: null, lignes: lignesDuModele() };
      fiches.push(f);
      naviguer(`/paysage/fiche/${f.id}`);
      return ok;
    },
    cocherLigneAction: async (id, ligneId, faite) => {
      const l = trouver(String(id))?.lignes.find((x) => x.id === ligneId);
      if (!l) return introuvable;
      l.faite = Boolean(faite);
      return ok;
    },
    majPassageAction: async (id, champs) => {
      const f = trouver(String(id));
      if (!f) return introuvable;
      Object.assign(f, champs);
      return ok;
    },
    // Ce que fait nommerClient (src/server/repositories/passages-entretien.ts) :
    // les cases de son DERNIER compte rendu envoyé se recochent, par la même
    // fonction pure ; celles d'un client précédent tombent.
    nommerClientAction: async (id, clientId) => {
      const f = trouver(String(id));
      if (!f) return introuvable;
      const dernier = fiches
        .filter((x) => x.clientId === clientId && x.envoyeLe !== null)
        .sort((a, b) => b.jour.localeCompare(a.jour))[0];
      const derniere = dernier ? dernier.lignes.filter((l) => l.faite).map((l) => ({ libelle: l.libelle })) : [];
      const changeDeClient = f.clientId !== null && f.clientId !== clientId;
      const actuelles = f.lignes;
      const lignes = cocherCommeLaDerniereFois(actuelles, derniere, { changeDeClient });
      const reprises = lignes.filter((l, i) => l.faite && (changeDeClient || !actuelles[i].faite));
      f.lignes = lignes;
      f.clientId = String(clientId);
      return { ok: true, reprises: reprises.map((l) => l.id), lignes: passage(f).lignes };
    },
    supprimerFicheAction: async (id) => {
      const i = fiches.findIndex((f) => f.id === id);
      if (i >= 0) fiches.splice(i, 1);
      return ok;
    },
    envoyerFicheAction: async (id, _canal, signature) => {
      const f = trouver(String(id));
      if (!f) return introuvable;
      f.envoyeLe = new Date();
      f.jeton = `rapport-${f.id}`;
      const s = signature as { png: string } | null;
      if (s) {
        f.signaturePng = s.png;
        f.signeeLe = new Date();
      }
      return { ok: true, lien: `/entretien/${f.jeton}`, facture: null };
    },
  },
  "src/app/paysage/fiche/composer/actions.ts": {
    ajouterPrestationAction: async (famille, libelle) => {
      prestations.push({ id: nouvelId("prestation"), famille: String(famille), libelle: String(libelle), ordre: prestations.length });
      return ok;
    },
    retirerPrestationAction: async (id) => {
      const i = prestations.findIndex((p) => p.id === id);
      if (i >= 0) prestations.splice(i, 1);
      return ok;
    },
    renommerPrestationAction: async (id, libelle) => {
      const p = prestations.find((x) => x.id === id);
      if (p) p.libelle = String(libelle);
      return ok;
    },
    renommerFamilleAction: async (ancienne, nouvelle) => {
      prestations.forEach((p) => { if (p.famille === ancienne) p.famille = String(nouvelle); });
      return ok;
    },
    retirerFamilleAction: async (famille) => {
      for (let i = prestations.length - 1; i >= 0; i--) if (prestations[i].famille === famille) prestations.splice(i, 1);
      return ok;
    },
    remettreLeModeleAction: async () => {
      const ajoutees = modeleManquant(prestations).map((m) => ({ id: nouvelId("prestation"), famille: m.famille, libelle: m.libelle, ordre: prestations.length }));
      prestations.push(...ajoutees);
      return { ok: true, ajoutees };
    },
  },
  "src/server/session-ctx.ts": {
    getCurrentCtx: async () => ({ utilisateurId: "demonstration", entrepriseId: "demonstration" }),
  },
  "src/server/autorisation.ts": {
    estProprietaire: async () => true,
    getRole: async () => "proprietaire",
  },
  "src/server/origine-publique.ts": {
    // Synchrone dans l'appli : le bouchon aussi.
    originePublique: (() => "https://cause.fr") as unknown as Action,
  },
  "src/server/repositories/prestations-entretien.ts": {
    listerPrestations: async () => [...prestations].sort((a, b) => a.ordre - b.ordre),
  },
  "src/server/repositories/clients.ts": {
    listerClients: async () => CLIENTS,
  },
  "src/server/repositories/entreprises.ts": {
    getEntreprise: async () => ENTREPRISE,
  },
  "src/server/repositories/passages-entretien.ts": {
    listerPassages: async () =>
      fiches.map((f) => ({ id: f.id, jour: f.jour, clientNom: client(f.clientId)?.nom ?? null, envoyeLe: f.envoyeLe, minutes: f.minutes, faites: f.lignes.filter((l) => l.faite).length, jeton: f.jeton })),
    lirePassage: async (_ctx, id) => {
      const f = trouver(String(id));
      return f ? passage(f) : null;
    },
    // « dernier » : le tournage montre le compte rendu qu'on vient
    // d'envoyer, sans connaître son jeton.
    lireRapportParJeton: async (jeton) => {
      const f = jeton === "dernier"
        ? [...fiches].filter((x) => x.envoyeLe).sort((a, b) => b.envoyeLe!.getTime() - a.envoyeLe!.getTime())[0]
        : fiches.find((x) => x.jeton === jeton);
      if (!f || !f.envoyeLe) return null;
      const c = client(f.clientId);
      return {
        jour: f.jour,
        minutes: f.tempsVisible ? f.minutes : null,
        observations: f.observations,
        clientNom: c?.nom ?? null,
        clientCivilite: c?.civilite ?? null,
        entrepriseNom: ENTREPRISE.nom,
        faites: passage(f).lignes.filter((l) => l.faite).map((l) => ({ famille: l.famille, libelle: l.libelle })),
        signature: f.signaturePng && f.signeeLe ? { png: f.signaturePng, signataire: c?.nom ?? "", jour: f.signeeLe.toISOString().slice(0, 10) } : null,
      };
    },
  },
  // L'envoi ouvrirait SA messagerie, le message prêt : la démonstration n'en
  // a pas, et l'écran dit déjà « Envoyé le … ».
  "src/lib/ouvrir-messagerie.ts": {
    ouvrirAdresse: (() => undefined) as unknown as Action,
  },
} satisfies Record<string, Record<string, Action>>);
