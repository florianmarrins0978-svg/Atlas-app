import assert from "node:assert/strict";
import {
  achatComplet,
  factureRepasExigee,
  montantSaisi,
  natureEnMots,
  pourquoiMoinsQueLeTicket,
  recuperation,
  tvaDeDepart,
  tvaDepuisTtc,
  tvaDue,
  type AchatARecuperer,
} from "../src/lib/achat-tva";

// La TVA d'un achat, et ce qu'il reste à payer.
//
// **Le défaut que cette suite empêche ne se voit sur aucune capture.** Un
// relevé faux d'un cinquième affiche un total parfaitement plausible : rien,
// à l'écran, ne distingue 20,00 € de 24,00 €. On s'en aperçoit devant le
// comptable, un an plus tard.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try { f(); console.log(`  ✓ ${nom}`); }
  catch (e) { echecs++; console.error(`  ✗ ${nom}\n    ${(e as Error).message}`); }
}

console.log("=== La TVA d'un achat, et le reste à payer ===\n");

// **LE PIÈGE PRINCIPAL.** Un total de ticket est TTC : la taxe est DEDANS.
// 120 × 0,20 = 24 € est le calcul qu'on fait de tête, et il est faux — c'est
// 20 €. Un cinquième d'écart sur chaque ticket, toute l'année.
cas("la TVA se retire d'un total qui la contient, jamais ne s'y ajoute", () => {
  assert.equal(tvaDepuisTtc(120, 20), 20);
  assert.notEqual(tvaDepuisTtc(120, 20), 24);
});

cas("les taux réduits tombent juste", () => {
  assert.equal(tvaDepuisTtc(110, 10), 10);
  assert.equal(tvaDepuisTtc(105.5, 5.5), 5.5);
});

cas("le résultat est arrondi au centime, pas à quatorze décimales", () => {
  const t = tvaDepuisTtc(96, 20);
  assert.equal(t, 16);
  assert.equal(String(t).split(".")[1]?.length ?? 0 <= 2, true);
  assert.equal(tvaDepuisTtc(42.5, 20), 7.08);
});

cas("rien de calculable ne rend rien — jamais zéro", () => {
  assert.equal(tvaDepuisTtc(null, 20), null);
  assert.equal(tvaDepuisTtc(120, null), null);
  assert.equal(tvaDepuisTtc(120, 0), null);
  assert.equal(tvaDepuisTtc(120, -20), null);
  assert.equal(tvaDepuisTtc(-10, 20), null);
  assert.equal(tvaDepuisTtc(NaN, 20), null);
});

// **Zéro serait un mensonge** : il se lit « cet achat n'a pas de TVA », alors
// que la vérité est « on ne sait pas ».
cas("un total nul reste un total, et rend zéro", () => {
  assert.equal(tvaDepuisTtc(0, 20), 0);
});

cas("le reste à payer est une soustraction, arrondie au centime", () => {
  assert.equal(tvaDue(164, 29), 135);
  assert.equal(tvaDue(164.55, 29.33), 135.22);
});

// **Un crédit de TVA est un état NORMAL** — le mois où l'on achète une machine
// sans facturer grand-chose. Le borner à zéro cacherait précisément le mois où
// le patron a le plus besoin de savoir.
cas("un mois plus acheteur que vendeur donne un montant négatif", () => {
  assert.equal(tvaDue(100, 260), -160);
});

cas("un montant se tape comme le patron l'écrit", () => {
  assert.equal(montantSaisi("16,00 €"), 16);
  assert.equal(montantSaisi("16.00"), 16);
  assert.equal(montantSaisi("1 234,50 €"), 1234.5);
  assert.equal(montantSaisi("1 234,50"), 1234.5);
  assert.equal(montantSaisi("  7,08  "), 7.08);
});

cas("ce qui n'est pas un nombre ne devient pas zéro", () => {
  assert.equal(montantSaisi(""), null);
  assert.equal(montantSaisi("   "), null);
  assert.equal(montantSaisi("€"), null);
  assert.equal(montantSaisi("abc"), null);
  assert.equal(montantSaisi(null), null);
  assert.equal(montantSaisi(undefined), null);
});

// **Le fournisseur et la TVA suffisent.** Un ticket qui n'affiche que
// « TVA 3,20 € » doit pouvoir être enregistré : exiger le total reviendrait à
// refuser l'achat, et un achat refusé est un achat perdu.
cas("un achat tient avec un fournisseur et une TVA, sans le total", () => {
  assert.equal(achatComplet("Station Total", 3.2), true);
  assert.equal(achatComplet("Station Total", 0), true);
});

cas("sans fournisseur ou sans TVA, l'achat n'est pas enregistrable", () => {
  assert.equal(achatComplet("", 16), false);
  assert.equal(achatComplet("   ", 16), false);
  assert.equal(achatComplet("Station Total", null), false);
  assert.equal(achatComplet("Station Total", -1), false);
});

// ─── Ce qui se récupère — sa demande du 13 octobre 2026 ─────────────────────
//
// *« Chaque entrée et chaque sortie doit être notée, mais si c'est une
// catégorie où il ne récupère pas la TVA, elle ne doit pas être
// comptabilisée. »* Avant, tout achat comptait en entier : un hôtel faisait
// baisser la TVA à payer. Planche : `appli/tva-ticket-carburant.html`.

const base: AchatARecuperer = {
  nature: "materiel",
  vehicule: null,
  repas: null,
  avecQui: null,
  pourquoi: null,
  justificatif: false,
  totalTtc: null,
  tauxTva: null,
  tvaTicket: 10,
};

cas("le plein d'un utilitaire se récupère en entier", () => {
  const r = recuperation({ ...base, nature: "carburant", vehicule: "utilitaire" });
  assert.equal(r.tvaRecuperee, 10);
  assert.deepEqual(r.manques, []);
});

// **Sa question : « c'est pas 20 % plutôt ? ».** Non : 20 % est le taux de la
// TVA dans le plein ; 80 % est la part de cette TVA que l'État rend pour une
// voiture. Un plein de 60 € porte 10 € de TVA, la voiture en récupère 8.
cas("le plein d'une voiture récupère 80 % de sa TVA, pas 20 %", () => {
  const r = recuperation({ ...base, nature: "carburant", vehicule: "voiture" });
  assert.equal(r.tvaRecuperee, 8);
  assert.notEqual(r.tvaRecuperee, 2);
});

cas("un carburant sans véhicule dit qu'il manque, il ne suppose pas", () => {
  const r = recuperation({ ...base, nature: "carburant", vehicule: null });
  assert.equal(r.tvaRecuperee, 0);
  assert.deepEqual(r.manques, ["le véhicule"]);
});

cas("l'hôtel, le train et le repas perso sont notés, jamais comptés", () => {
  assert.equal(recuperation({ ...base, nature: "hotel" }).tvaRecuperee, 0);
  assert.equal(recuperation({ ...base, nature: "transport" }).tvaRecuperee, 0);
  assert.equal(recuperation({ ...base, nature: "repas", repas: "perso" }).tvaRecuperee, 0);
});

cas("le matériel et « autre » comptent en entier, comme avant", () => {
  assert.equal(recuperation({ ...base, nature: "materiel" }).tvaRecuperee, 10);
  assert.equal(recuperation({ ...base, nature: "autre" }).tvaRecuperee, 10);
});

// **Sa consigne : « qu'on ne puisse pas nous reprocher quoi que ce soit ».**
// BOI-TVA-DECLA-30-20-20 § 150 : la déduction est subordonnée à
// l'identification du client portée sur la note. Sans les trois preuves, le
// repas est noté mais sa TVA ne compte pas.
const affaires: AchatARecuperer = {
  ...base,
  nature: "repas",
  repas: "affaires",
  totalTtc: 86,
  tauxTva: 10,
  tvaTicket: 7.82,
};

cas("un repas d'affaires sans ses preuves ne compte pas, et dit ce qui manque", () => {
  const r = recuperation(affaires);
  assert.equal(r.tvaRecuperee, 0);
  assert.deepEqual(r.manques, ["avec qui", "pourquoi", "le nom de l’entreprise sur la note"]);
});

cas("des preuves faites d'espaces ne sont pas des preuves", () => {
  const r = recuperation({ ...affaires, avecQui: "   ", pourquoi: " ", justificatif: true });
  assert.equal(r.tvaRecuperee, 0);
  assert.deepEqual(r.manques, ["avec qui", "pourquoi"]);
});

cas("un repas d'affaires avec ses trois preuves compte en entier", () => {
  const r = recuperation({ ...affaires, avecQui: "M. Durand", pourquoi: "Devis du jardin", justificatif: true });
  assert.equal(r.tvaRecuperee, 7.82);
  assert.deepEqual(r.manques, []);
});

// § 140 : l'allègement de la note ne vaut que jusqu'à 150 € HT. 150 € HT à
// 10 % font 165 € TTC : le seuil se lit sur le HT, jamais sur le total payé.
cas("au delà de 150 € HT, c'est une facture qui est exigée, pas la note", () => {
  assert.equal(factureRepasExigee(165, 10), false);
  assert.equal(factureRepasExigee(165.01, 10), true);
  assert.equal(factureRepasExigee(160, 10), false);
  const r = recuperation({ ...affaires, totalTtc: 220, avecQui: "M. Durand", pourquoi: "Devis" });
  assert.deepEqual(r.manques, ["la facture au nom de l’entreprise"]);
});

// Un HT qu'on ne connaît pas ne se suppose pas sous le seuil : c'est la pièce
// la plus exigeante qu'on demande.
cas("sans total ni taux, la facture est exigée", () => {
  assert.equal(factureRepasExigee(null, 10), true);
  assert.equal(factureRepasExigee(86, null), true);
});

cas("un repas sans « affaires » ni « perso » ne compte pas", () => {
  const r = recuperation({ ...base, nature: "repas", repas: null });
  assert.equal(r.tvaRecuperee, 0);
  assert.deepEqual(r.manques, ["affaires ou perso"]);
});

cas("la liste dit ce qu'est l'achat, en phrase, et n'invente rien aux anciens", () => {
  const vide = { vehicule: null, repas: null, avecQui: null };
  assert.equal(natureEnMots({ ...vide, nature: null }), null);
  assert.equal(natureEnMots({ ...vide, nature: "carburant", vehicule: "voiture" }), "Carburant d’une voiture");
  assert.equal(natureEnMots({ ...vide, nature: "repas", repas: "affaires", avecQui: " M. Durand " }), "Repas d’affaires avec M. Durand");
  assert.equal(natureEnMots({ ...vide, nature: "transport" }), "Train, taxi");
});

cas("la part se calcule sur la TVA du ticket, arrondie au centime", () => {
  const r = recuperation({ ...base, nature: "carburant", vehicule: "voiture", tvaTicket: 13.33 });
  assert.equal(r.tvaRecuperee, 10.66);
});

// **Sa remarque du 23 octobre 2026** : le comptable lit 8,33 € de TVA sur le
// ticket et 6,66 € au relevé, et rien ne dit pourquoi. Toute ligne qui compte
// MOINS que son ticket le dit ; une ligne qui compte tout se tait.
cas("une ligne qui compte moins que son ticket dit pourquoi, et sur combien", () => {
  const base = { vehicule: null, repas: null, tvaTicket: "8.33", tvaDeductible: "0" } as const;
  const attendu: [Parameters<typeof pourquoiMoinsQueLeTicket>[0], string][] = [
    [{ ...base, nature: "carburant", vehicule: "voiture", tvaDeductible: "6.66" }, "Voiture, 80 %"],
    [{ ...base, nature: "hotel" }, "Hôtel, non récupérable"],
    [{ ...base, nature: "transport" }, "Train, taxi, non récupérable"],
    [{ ...base, nature: "repas", repas: "perso" }, "Repas perso, non récupérable"],
    [{ ...base, nature: "repas", repas: "affaires" }, "Repas d’affaires, preuves à compléter"],
    [{ ...base, nature: "carburant" }, "Véhicule à choisir"],
    [{ ...base, nature: "repas" }, "Repas, affaires ou perso à choisir"],
  ];
  for (const [achat, mot] of attendu) {
    assert.deepEqual(pourquoiMoinsQueLeTicket(achat), { mot, tvaTicket: "8.33" }, mot);
  }
});

cas("une ligne qui compte toute sa TVA, ou un achat d'avant les natures, se tait", () => {
  const plein = { vehicule: "utilitaire", repas: null, tvaTicket: "8.33", tvaDeductible: "8.33" } as const;
  assert.equal(pourquoiMoinsQueLeTicket({ ...plein, nature: "carburant" }), null);
  assert.equal(pourquoiMoinsQueLeTicket({ ...plein, nature: "materiel" }), null);
  assert.equal(pourquoiMoinsQueLeTicket({ ...plein, nature: null, tvaDeductible: "0" }), null);
  assert.equal(pourquoiMoinsQueLeTicket({ ...plein, nature: "hotel", tvaTicket: null, tvaDeductible: "0" }), null);
});

cas("un ticket lu sans sa TVA propose celle du total et du taux, au lieu de griser le bouton", () => {
  // Sa remarque du 27 octobre 2026 : le ticket de 18,90 € s'ouvrait avec une
  // TVA vide, le bouton restait grisé sans un mot, et l'écart avec la ligne de
  // banque ne pouvait jamais s'afficher.
  assert.equal(tvaDeDepart({ tvaDeductible: null, totalTtc: 18.9, tauxTva: null }), 3.15);
  assert.equal(tvaDeDepart({ tvaDeductible: null, totalTtc: 120, tauxTva: 10 }), 10.91);
  // La TVA lue sur le ticket fait foi : elle ne se recalcule jamais.
  assert.equal(tvaDeDepart({ tvaDeductible: 3.2, totalTtc: 18.9, tauxTva: null }), 3.2);
  // Sans total, rien ne se calcule, rien ne s'invente.
  assert.equal(tvaDeDepart({ tvaDeductible: null, totalTtc: null, tauxTva: null }), null);
  assert.equal(tvaDeDepart(null), null);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} TVA d'un achat — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
