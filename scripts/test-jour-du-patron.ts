/**
 * LE JOUR SE COMPTE CHEZ LUI, PAS À GREENWICH.
 *
 * Sa question du 25 août 2026 : *« ce soir à 00 h 00 il passe dans terminé ? »*.
 * Il passait à **2 h du matin** — Atlas comptait ses journées en UTC. Entre
 * minuit et deux heures, l'été, un chantier de la journée restait au planning
 * et une facture faite en rentrant portait la date de la veille.
 *
 * Ce contrôle sait rougir : joué contre l'ancienne version (`toISOString`),
 * trois de ses sept cas tombent — vérifié avant de le livrer.
 */
import { jourIso } from "../src/lib/jour";
import { ongletDepuisJalons } from "../src/lib/onglet-chantier";

const echecs: string[] = [];
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs.push(quoi);
};

console.log("=== Le jour se compte à son heure ===\n");

// Été (UTC+2) : minuit et demi à Buchelay, c'est encore 22 h 30 la veille en UTC.
dire(jourIso(new Date("2026-08-25T22:30:00Z")) === "2026-08-26", "00 h 30 l'été : on est DÉJÀ le lendemain");
dire(jourIso(new Date("2026-08-25T21:59:00Z")) === "2026-08-25", "23 h 59 l'été : on est encore la veille");

// Hiver (UTC+1) : la bascule tombe à 23 h UTC, pas à 22 h.
dire(jourIso(new Date("2026-01-15T23:30:00Z")) === "2026-01-16", "00 h 30 l'hiver : on est déjà le lendemain");
dire(jourIso(new Date("2026-01-15T22:30:00Z")) === "2026-01-15", "23 h 30 l'hiver : on est encore la veille");

// Milieu de journée : rien ne change, et c'est le cas de tous les jours.
dire(jourIso(new Date("2026-08-25T12:00:00Z")) === "2026-08-25", "midi : le jour est celui qu'on croit");

// ── Ce qu'il demandait vraiment : quand son chantier change d'onglet ─────────
const chantier = { termineAt: null, factureEnvoyeeAt: null, datePlanifiee: "2026-08-25" };
dire(
  ongletDepuisJalons(chantier, jourIso(new Date("2026-08-25T21:59:00Z"))) === "planning",
  "à 23 h 59, son chantier du jour est ENCORE au planning",
);
dire(
  ongletDepuisJalons(chantier, jourIso(new Date("2026-08-25T22:30:00Z"))) === "termines",
  "à 00 h 30, il est passé dans Terminés — pas à 2 h",
);

console.log(`\n${echecs.length === 0 ? "✅" : "❌"} Le jour du patron — ${echecs.length} échec(s).`);
process.exit(echecs.length === 0 ? 0 : 1);
