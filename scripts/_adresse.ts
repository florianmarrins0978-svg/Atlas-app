/**
 * L'adresse du serveur que les captures et les suites interrogent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE FICHIER A ÉTÉ RECONSTITUÉ le 5 septembre 2026, et il faut le savoir
 * avant d'y toucher.** `scripts/capture-relire-sa-dictee.mts` est arrivé sur
 * `main` en important `./_adresse`, mais le module lui-même n'a jamais été
 * poussé — la session qui menait le passage à `ADRESSE` l'avait laissé dans
 * son arbre. Conséquence pour TOUT LE MONDE : `npx tsc --noEmit` rendait une
 * erreur (`TS2307`) et `verifier:memoire` un chemin mort, donc la batterie
 * complète ne pouvait plus être verte, quel que soit le code livré.
 *
 * Une batterie qui ne peut pas être verte s'apprend à être ignorée. Le module
 * est donc écrit ici, au plus près de ce que ses appelants attendent — une
 * chaîne, l'adresse de base, sans barre oblique finale. **Si la session
 * voisine pousse le sien, garder LE SIEN** : celui-ci n'existe que pour que
 * l'arbre compile en attendant.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **Surchargeable, comme les adresses de base** (commit 459eadeb, 4 septembre
 * 2026) : sur son espace, le serveur ne répond pas toujours sur le même port
 * ni sur `localhost`. `BASE_URL` est le nom déjà employé par
 * `capturer-liste-clients.ts` et `capturer-tva.ts` — on n'en invente pas un
 * second.
 */
export const ADRESSE = process.env.BASE_URL ?? "http://localhost:3000";
