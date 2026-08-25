import assert from "node:assert/strict";
import { lireReponseDiscussion, etatDuPlanEnClair } from "../src/server/ai/services/discuter-plan";
import type { ParametresPlan } from "../src/lib/arrosage/consignes";

/**
 * CE QUE LE MODÈLE A LE DROIT DE RENDRE — la discussion du plan d'arrosage.
 *
 * **`lireReponseDiscussion` est pure : elle s'éprouve sans clé et sans réseau.**
 * L'appel au fournisseur, lui, ne peut pas l'être ici — aucune clé dans cet
 * environnement (`AGENTS.md`), et cela s'écrit plutôt que de laisser croire à
 * une vérification qui n'a pas eu lieu.
 *
 * **Le piège central : un modèle répond toujours.** Il pose des consignes hors
 * catalogue avec l'aplomb d'un fournisseur, il rend du texte vide en croyant
 * avoir répondu, il enrobe son JSON de prose. Chacun de ces travers a un cas
 * ici, et chacun a été observé sur les autres lectures de ce dépôt.
 */

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs++;
};

const PARAM: ParametresPlan = {
  seau: 10, temps: 20, pression: 3, compteur: "oui", regardVersZone: 0,
  zones: [
    { id: 1, type: "gazon", nom: "Carré", L: 12, l: 12, x: 0, y: 0 },
    { id: 2, type: "gazon", nom: "Bande", L: 8, l: 4, x: 12, y: 0 },
  ],
  nourrice: { x: 0, y: 4 },
};

console.log("\n=== Discuter le plan : ce que le modèle a le droit de rendre ===\n");

// ── 1. Le cas nominal : une explication, sans modification ──────────────────
{
  const r = lireReponseDiscussion(
    JSON.stringify({ texte: "Parce que le compteur donne 1,80 m³/h.", chiffres: "1,80 m³/h · 2,34 demandés", consigne: null }),
    PARAM
  );
  dire(r.ok, "une explication sans modification est acceptée");
  dire(r.ok && r.reponse.consigne === null, "et elle ne pose aucune consigne");
  dire(r.ok && r.reponse.chiffres === "1,80 m³/h · 2,34 demandés", "les chiffres à l'appui sont gardés");
}

// ── 2. Une modification du catalogue passe ─────────────────────────────────
{
  const r = lireReponseDiscussion(
    JSON.stringify({ texte: "Oui, je passe la bande en 15-VAN.", chiffres: null, consigne: { quoi: "buse", zone: 2, valeur: "RBT601" } }),
    PARAM
  );
  dire(r.ok && r.reponse.consigne?.quoi === "buse", r.ok ? "une buse du catalogue est posée" : "refusée à tort");
}

// ── 3. UNE RÉFÉRENCE INVENTÉE NE PASSE PAS — mais la réponse reste ──────────
//
// **Le piège du 21 août, en pire.** Laissé libre, le modèle avait inventé
// « 5004 buse 3.0, portée 6 m », qui n'existe pas, et tout le maillage en
// dépendait. Ici la modification est jetée — mais son explication, elle, est
// gardée : jeter les deux lui ferait relire une question à laquelle on avait
// répondu.
{
  const r = lireReponseDiscussion(
    JSON.stringify({ texte: "Je passe en 5006.", chiffres: null, consigne: { quoi: "buse", zone: 1, valeur: "RB-5006" } }),
    PARAM
  );
  dire(r.ok, "la réponse est rendue malgré la référence inventée");
  dire(r.ok && r.reponse.consigne === null, "mais AUCUNE modification n'est appliquée");
  dire(
    r.ok && /n’est pas au catalogue/.test(r.reponse.texte),
    "et il lit pourquoi, dans la réponse elle-même",
  );
  dire(r.ok && /5006/.test(r.reponse.texte), "son explication d'origine est conservée");
}

// ── 4. CE QUI SORT DE LA LISTE FERMÉE NE PASSE PAS ─────────────────────────
//
// Sa borne du 21 août : la discussion ne crée jamais un plan. Un modèle qui
// tenterait d'imposer un nombre de réseaux ou de déplacer la nourrice doit se
// heurter à un mur.
for (const tentative of [
  { quoi: "reseaux", valeur: 3 },
  { quoi: "nourrice", valeur: "0,4" },
  { quoi: "tranchee", valeur: 64 },
]) {
  const r = lireReponseDiscussion(JSON.stringify({ texte: "Voilà.", consigne: tentative }), PARAM);
  dire(r.ok && r.reponse.consigne === null, `« ${tentative.quoi} » n'est pas posé sur le calcul`);
}

// ── 5. Ce qui doit être refusé net ─────────────────────────────────────────
{
  dire(!lireReponseDiscussion("Bien sûr ! Voici ma réponse.", PARAM).ok, "une réponse sans objet est refusée");
  dire(!lireReponseDiscussion("{ texte: ", PARAM).ok, "un objet mal formé est refusé");
  dire(
    !lireReponseDiscussion(JSON.stringify({ texte: "   ", consigne: null }), PARAM).ok,
    "un texte vide est refusé — un modèle qui croit avoir répondu n'a rien dit",
  );
}

// ── 6. Un objet noyé dans de la prose est retrouvé ─────────────────────────
{
  const r = lireReponseDiscussion(
    'Voici : {"texte":"Oui.","chiffres":null,"consigne":null} — voilà.',
    PARAM
  );
  dire(r.ok, "un objet entouré de prose est retrouvé");
}

// ── 7. L'ÉTAT DU PLAN DONNÉ AU MODÈLE PORTE LES VRAIS CHIFFRES ─────────────
//
// **Sans eux, il répond quand même** — avec des nombres plausibles. C'est la
// seule défense contre un « votre compteur donne 2 m³/h » sorti de nulle part.
{
  const clair = etatDuPlanEnClair(PARAM, {
    debitDisponible: 1.8,
    limite: 1.53,
    secteurs: [{ nom: "Carré", debit: 1.24 }],
    dessin: [{ id: 1, nom: "Carré", cle: "turbine", modele: "Turbine", buse: "3504 · buse 0,75", portee: 5.14, points: [1, 2, 3] }],
  });
  dire(/1\.80|1,80/.test(clair), "le débit disponible est donné au modèle");
  dire(/1\.53|1,53/.test(clair), "le plafond d'une voie aussi — c'est lui qui décide du nombre de réseaux");
  dire(/zone 1/.test(clair), "et chaque zone porte son NUMÉRO, puisque les consignes le désignent");
}

console.log(`\n${echecs === 0 ? "✅" : "❌"} La discussion du plan — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
