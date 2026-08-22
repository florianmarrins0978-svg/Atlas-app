import assert from "node:assert/strict";
// Module JavaScript repris tel quel de `appli/` : `allowJs` le laisse passer,
// et `checkJs` étant coupé, il n'est pas typé. C'est voulu — le typer aurait
// été le réécrire, donc en faire une seconde implémentation.
import { calculerPlan, optionsCatalogue } from "../src/lib/arrosage/calcul.js";

// Le calcul d'arrosage, tel qu'il tourne dans l'application.
//
// **Ce fichier ne réécrit rien** : `src/lib/arrosage/calcul.js` est la copie du
// calcul que le patron éprouve sur son téléphone depuis le 17 août 2026. Ce que
// cette suite tient, c'est que la PORTE D'ENTRÉE serveur rend bien ce que le
// calcul rend — et que rien ne s'invente au passage.
//
// **LE CONTRÔLE QUI COMPTE EST LE DÉBIT.** Un réseau qui demande plus que ce que
// le compteur donne, c'est un arroseur qui ne monte pas — et le paysagiste le
// découvre chez le client, pas ici.

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs++;
};

// Le jardin de la maquette : 96 m² devant, 120 m² derrière, 34 m de haie.
const JARDIN = {
  seau: 10,
  temps: 20,
  pression: 3,
  compteur: "oui",
  zones: [
    { type: "gazon", nom: "Pelouse devant", L: 16, l: 6 },
    { type: "gazon", nom: "Pelouse derrière", L: 15, l: 8 },
    { type: "haie", nom: "Haie", ml: 22 },
    { type: "massif", nom: "Massifs", ml: 12 },
  ],
};

console.log("=== Le calcul d'arrosage, côté serveur ===\n");

const plan = calculerPlan(JARDIN);

// ── 1. Le débit au seau ─────────────────────────────────────────────────────
// 10 L en 20 s font 0,5 L/s, donc 1,80 m³/h. C'est le chiffre de sa capture.
dire(
  Math.abs(plan.debitDisponible - 1.8) < 0.001,
  `10 L en 20 s donnent ${plan.debitDisponible.toFixed(2)} m³/h`,
);

// ── 2. AUCUN RÉSEAU AU-DESSUS DU DÉBIT ──────────────────────────────────────
//
// C'est la raison d'être du découpage. Sans ce contrôle, la suite entière
// pourrait passer au vert sur un plan qui ne peut pas fonctionner.
const pire = Math.max(...plan.secteurs.map((s: { debit: number }) => s.debit));
dire(
  pire <= plan.limite + 1e-9,
  `le réseau le plus gourmand demande ${pire.toFixed(2)} m³/h pour ${plan.limite.toFixed(2)} admis`,
);
dire(plan.secteurs.length >= 2, `${plan.secteurs.length} réseaux — un jardin de cette taille en demande plusieurs`);

// **La demande totale doit dépasser le débit**, sinon un seul réseau aurait
// suffi et le découpage ne servirait à rien.
dire(
  plan.demande > plan.debitDisponible,
  `la demande totale (${plan.demande.toFixed(2)} m³/h) dépasse le disponible (${plan.debitDisponible.toFixed(2)})`,
);

// ── 3. Le programmateur a assez de voies ────────────────────────────────────
dire(
  plan.voies >= plan.secteurs.length,
  `programmateur ${plan.voies} voies pour ${plan.secteurs.length} réseaux`,
);

// ── 4. Le matériel sort du CATALOGUE, pas de nulle part ─────────────────────
dire(plan.materiel.length > 0, `${plan.materiel.length} lignes de matériel`);
const sansNom = plan.materiel.filter((l: { nom?: string }) => !l.nom || !l.nom.trim());
dire(sansNom.length === 0, `aucune ligne de matériel sans libellé (${sansNom.length} trouvée(s))`);
const quantitesFausses = plan.materiel.filter(
  (l: { q: number }) => !Number.isFinite(l.q) || l.q <= 0
);
dire(
  quantitesFausses.length === 0,
  `aucune quantité nulle ou absurde${quantitesFausses.length ? ` — ${JSON.stringify(quantitesFausses[0])}` : ""}`,
);

// ── 5. Un jardin vide ne rend pas un plan ───────────────────────────────────
const vide = calculerPlan({ seau: 10, temps: 20, zones: [] });
dire(vide.secteurs.length === 0, "aucune zone : aucun réseau, et non un réseau vide");

// ── 6. Une mesure EFFACÉE ne donne pas un débit inventé ─────────────────────
//
// **Ce que ce contrôle a appris.** Il exigeait d'abord qu'un appel SANS mesure
// rende zéro. Il rendait 1,80 — parce que le calcul repris part de valeurs par
// défaut (10 L en 20 s), comme le fait sa page depuis le 17 août : les champs
// y sont pré-remplis, et il les corrige sous les yeux.
//
// Ce n'est donc pas une invention tant que les cases sont VISIBLES et
// modifiables. Ce qui en serait une, c'est de rendre un débit quand il a effacé
// la mesure — et c'est cela qu'on tient ici.
const efface = calculerPlan({ seau: 0, temps: 0, zones: JARDIN.zones });
dire(
  efface.debitDisponible === 0,
  `mesure effacée : le débit vaut ${efface.debitDisponible} — il ne se devine pas`,
);
dire(
  efface.secteurs.every((s: { debit: number }) => s.debit > 0),
  "sans débit connu, le découpage ne rend pas de réseaux à zéro",
);

// ── 7. Deux appels de suite ne se contaminent pas ───────────────────────────
//
// Le calcul repris travaille sur un état global : sur un serveur, deux
// artisans calculent en même temps. La porte d'entrée le restaure en sortant,
// et c'est ce qu'on vérifie ici.
const encore = calculerPlan(JARDIN);
dire(
  encore.secteurs.length === plan.secteurs.length &&
    Math.abs(encore.debitDisponible - plan.debitDisponible) < 1e-9,
  `un second appel rend le même plan (${encore.secteurs.length} réseaux, ${encore.debitDisponible.toFixed(2)} m³/h)`,
);
const autre = calculerPlan({ seau: 5, temps: 20, zones: [{ type: "gazon", L: 10, l: 5 }] });
const apres = calculerPlan(JARDIN);
dire(
  apres.secteurs.length === plan.secteurs.length,
  `un appel intercalé (${autre.secteurs.length} réseaux) ne change pas le suivant`,
);

// ── 8. Le catalogue est là, et il se déclare ────────────────────────────────
const options = optionsCatalogue();
dire(options.marques.length >= 2, `${options.marques.length} marques proposées`);
dire(
  options.marques.some((m: { defaut?: boolean }) => m.defaut),
  "une marque est le défaut, comme il l'a demandé (Rain Bird)",
);

// ── 9. LE SEUIL Ø25 → Ø32, ET SON ACCORD AVEC LE VERDICT ────────────────────
//
// **Sa demande du 22 août 2026 :** *« passé un certain nombre de mètres
// linéaires, il faut passer du PEHD Ø25 à celui en Ø32 ; j'aimerais que mon
// outil arrosage puisse faire la même chose. »*
//
// **Le contrôle qui compte n'est pas la valeur du seuil, c'est son ACCORD avec
// le verdict.** Deux chiffres sortent maintenant du même calcul : « le Ø25
// tient jusqu'à 54 m » et, sur une longueur saisie, « le Ø25 suffit / ne suffit
// pas ». S'ils se contredisent — et une formule retournée de travers les
// contredirait sans rien casser d'autre —, c'est la liste entière qu'on cesse
// de croire (`CLAUDE.md` §4 bis). On éprouve donc les deux côtés du seuil.
{
  const auSeuil = calculerPlan({ ...JARDIN, amenee: 1 });
  const seuil = auSeuil.amenee.longueurMax25;
  // **`seuil > 0` NE PROUVAIT RIEN, et il a fallu le voir pour le croire.** En
  // retournant la formule de travers (multiplier au lieu de diviser), le seuil
  // tombe à quatre dix-millièmes de mètre : « supérieur à zéro », donc vert,
  // en annonçant « 0 m » à l'écran. C'est le contrôle qui mesure zéro du
  // `CLAUDE.md` §5, dans sa version la plus sournoise — il affichait le bon
  // chiffre et concluait le contraire.
  //
  // On exige donc une longueur PLAUSIBLE : sous 5 m, aucune amenée ne serait
  // jamais en Ø25 ; au-delà de 500 m, ce n'est plus un jardin.
  dire(
    seuil >= 5 && seuil <= 500,
    `le Ø25 tient jusqu'à ${seuil.toFixed(0)} m à ${auSeuil.amenee.debit.toFixed(2)} m³/h`,
  );

  const avant = calculerPlan({ ...JARDIN, amenee: Math.floor(seuil) - 1 });
  const apres = calculerPlan({ ...JARDIN, amenee: Math.ceil(seuil) + 1 });
  dire(
    avant.amenee.diametre === 25 && apres.amenee.diametre === 32,
    `un mètre avant le seuil : Ø${avant.amenee.diametre} · un mètre après : Ø${apres.amenee.diametre}`,
  );

  // Le Ø32 tient forcément plus loin que le Ø25, à débit égal. Une inversion
  // des diamètres dans la formule se verrait ici, et nulle part ailleurs.
  //
  // **Et « plus loin » se mesure, sinon deux quasi-zéros le satisfont.** Le
  // rapport réel vaut 3,4 à section constante ; on exige au moins le double,
  // ce qu'aucune erreur de diamètre ne franchit par hasard.
  dire(
    auSeuil.amenee.longueurMax32 >= auSeuil.amenee.longueurMax25 * 2,
    `le Ø32 tient plus loin (${auSeuil.amenee.longueurMax32.toFixed(0)} m) que le Ø25 (${seuil.toFixed(0)} m)`,
  );

  // **LE DÉBIT PASSE AVANT LA LONGUEUR.** Un tuyau court ne perd presque rien :
  // sur la seule perte de charge, un Ø25 « passerait » à n'importe quel débit
  // pourvu qu'il soit assez court. Au-delà de 1,5 m/s l'eau cogne — d'où
  // 1,76 m³/h maximum en Ø25, et un seuil qui tombe à ZÉRO plutôt que de rester
  // rassurant.
  //
  // 10 L en 8 s font 4,50 m³/h : de quoi charger un réseau bien au-delà.
  const gros = calculerPlan({
    seau: 10, temps: 8, pression: 3, amenee: 5,
    zones: [{ type: "gazon", nom: "Grande pelouse", L: 40, l: 30 }],
  });
  dire(
    gros.amenee.debit > gros.amenee.debitMax25 && gros.amenee.diametre === 32,
    `${gros.amenee.debit.toFixed(2)} m³/h : Ø32 sur 5 m malgré la perte de charge faible`,
  );
  dire(
    gros.amenee.longueurMax25 === 0,
    "aucune longueur de Ø25 n'est annoncée quand le débit l'interdit — et non un seuil qu'on croirait",
  );

  // Ce jardin-ci reste dans le Ø25 : le contrôle ci-dessus ne doit pas rougir
  // partout, sinon il ne dit plus rien.
  dire(
    plan.amenee.diametre === 25,
    `le jardin de la maquette reste en Ø25 (${plan.amenee.debit.toFixed(2)} m³/h sur ${plan.amenee.longueur} m)`,
  );
}

// ── 10. LA BUSE EST RAMENÉE À LA PRESSION DU CHANTIER ───────────────────────
//
// **Sa demande du 22 août 2026 : « oui code le ».** Le catalogue ne donne qu'une
// valeur par buse, à une pression de référence (2,5 bar pour ses turbines Rain
// Bird). Le calcul les prenait telles quelles : sur un robinet à 2 bar, cela
// mettait un arroseur de trop par réseau — la pression tombe, les turbines
// sortent à moitié, et le gazon jaunit en bout de ligne.
{
  const ZONE = [{ type: "gazon", nom: "Pelouse", L: 20, l: 12 }];
  const aLaReference = calculerPlan({ seau: 10, temps: 20, pression: 2.5, zones: ZONE });
  const quadruple = calculerPlan({ seau: 10, temps: 20, pression: 10, zones: ZONE });
  const moitie = calculerPlan({ seau: 10, temps: 20, pression: 2, zones: ZONE });

  // **√4 = 2 : à quatre fois la pression, un orifice débite deux fois plus.**
  // C'est la loi de Torricelli, et c'est le contrôle qui la tient. Au-dessus de
  // la référence la portée ne bouge pas (voir plus bas), donc la buse choisie
  // est la même et la demande double EXACTEMENT — une tolérance large
  // laisserait passer un exposant de travers.
  const rapport = quadruple.demande / aLaReference.demande;
  dire(
    Math.abs(rapport - 2) < 0.02,
    `à 4 × la pression, la demande vaut ${rapport.toFixed(3)} × celle de référence (2 attendu)`,
  );

  // **La portée ne se GONFLE jamais.** L'exposant de la portée est une
  // estimation, pas un relevé de ses catalogues : l'appliquer vers le haut
  // ferait espacer les arroseurs sur un chiffre supposé, et un espacement trop
  // large est un trou d'arrosage qu'on ne découvre qu'en juillet.
  const teteRef = aLaReference.materiel.find((m: { nom: string }) => /buse/i.test(m.nom));
  const teteHaut = quadruple.materiel.find((m: { nom: string }) => /buse/i.test(m.nom));
  dire(
    teteRef !== undefined && teteHaut !== undefined && teteRef.q === teteHaut.q,
    `à 4 × la pression, le même nombre d'arroseurs (${teteRef?.q} → ${teteHaut?.q}) : la portée n'a pas été gonflée`,
  );

  // **En dessous, on réduit — et ça se voit.** Moins de portée, donc au moins
  // autant d'arroseurs ; moins de débit par tête, mais la pose se resserre.
  // Ce qui est tenu ici : le calcul n'est plus indifférent à la pression.
  dire(
    Math.abs(moitie.demande - aLaReference.demande) > 0.001,
    `à 2 bar la demande (${moitie.demande.toFixed(2)}) diffère de celle à 2,5 bar (${aLaReference.demande.toFixed(2)})`,
  );

  // **À la pression de référence, RIEN ne doit changer.** Une correction qui
  // s'applique même à rapport égal introduirait un écart d'arrondi partout, et
  // les plans d'hier ne seraient plus ceux d'aujourd'hui sans raison.
  const encore = calculerPlan({ seau: 10, temps: 20, pression: 2.5, zones: ZONE });
  dire(
    encore.demande === aLaReference.demande,
    `à la pression du catalogue, le plan est inchangé (${encore.demande.toFixed(3)} m³/h)`,
  );
}

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
