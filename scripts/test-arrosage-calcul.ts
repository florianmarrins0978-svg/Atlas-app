import assert from "node:assert/strict";
// Module JavaScript repris tel quel de `appli/` : `allowJs` le laisse passer,
// et `checkJs` étant coupé, il n'est pas typé. C'est voulu — le typer aurait
// été le réécrire, donc en faire une seconde implémentation.
import { calculerPlan, optionsCatalogue, quantiteEcrite } from "../src/lib/arrosage/calcul.js";

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

  // **LE SEUIL N'EST PLUS UNE CONSTANTE, et c'est le prix de l'auto-cohérence.**
  // Depuis que la pression retenue est celle du dernier arroseur (§12),
  // allonger l'amenée fait perdre davantage, donc baisse cette pression, donc
  // change la buse retenue et son débit — et le seuil avec. Vérifier la
  // bascule au mètre près n'a donc plus de sens : c'est un point fixe, pas une
  // frontière fixe.
  //
  // Ce qui reste vrai et qui compte : **il existe une bascule, et le Ø25 tient
  // du bon côté.** On l'éprouve aux deux bouts.
  const court = calculerPlan({ ...JARDIN, amenee: 5 });
  const long = calculerPlan({ ...JARDIN, amenee: 400 });
  dire(
    court.amenee.diametre === 25 && long.amenee.diametre === 32,
    `amenée de 5 m : Ø${court.amenee.diametre} · de 400 m : Ø${long.amenee.diametre}`,
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

  // **LE DÉBIT PASSE AVANT LA LONGUEUR — et depuis le plafond du découpage,
  // ce cas ne se produit PLUS par le chemin normal.** Un tuyau court ne perd
  // presque rien : sur la seule perte de charge, un Ø25 « passerait » à
  // n'importe quel débit pourvu qu'il soit assez court. Le critère de vitesse
  // d'`amenee()` existe pour ça, et il reste en place — mais depuis que le
  // découpage plafonne chaque réseau à ce que le Ø25 laisse passer (§11
  // ci-dessous, sa déduction du 22 août), aucun secteur ne peut plus l'armer.
  //
  // **On le dit plutôt que de laisser croire qu'il veille.** Un contrôle qui ne
  // peut plus rougir ne prouve rien (`CLAUDE.md` §5), et le prétendre serait
  // pire que de l'avoir retiré. Ce qui est éprouvé ici, c'est la GARANTIE qui
  // l'a rendu inatteignable : quelle que soit la source, l'amenée n'est jamais
  // en surrégime.
  //
  // 10 L en 8 s font 4,50 m³/h — de quoi charger un réseau bien au-delà, avant.
  const gros = calculerPlan({
    seau: 10, temps: 8, pression: 3, amenee: 5,
    zones: [{ type: "gazon", nom: "Grande pelouse", L: 40, l: 30 }],
  });
  dire(
    gros.amenee.debit <= gros.amenee.debitMax25 + 1e-9,
    `source à 4,50 m³/h : l'amenée ne porte que ${gros.amenee.debit.toFixed(2)} m³/h ` +
      `pour ${gros.amenee.debitMax25.toFixed(2)} admis en Ø25 — le plafond a tenu en amont`,
  );
  dire(
    gros.amenee.longueurMax25 > 0,
    `et le seuil du Ø25 reste calculable (${gros.amenee.longueurMax25.toFixed(0)} m) : ` +
      "aucune longueur n'est annoncée à zéro sans raison",
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

  // **LA LOI S'ÉPROUVE À BUSE CONSTANTE — et c'est le raffinement qui l'impose.**
  //
  // La première version comparait 2,5 bar à 10 bar et exigeait un rapport de
  // débit de exactement 2 (√4). Elle a cessé d'être juste le soir même, quand
  // la pression de dimensionnement est devenue celle du DERNIER ARROSEUR
  // (§12) : à 10 bar de source il n'en arrive plus 10 au bout, et à 2,5 la
  // portée réduite fait choisir une buse plus petite. Deux choses changeaient
  // à la fois, et le rapport ne prouvait plus rien.
  //
  // On compare donc deux pressions PROCHES, où la même buse est retenue, et
  // l'on exige alors l'égalité avec √(P₂/P₁) — les pressions étant celles qui
  // arrivent vraiment aux arroseurs, pas celles de la source.
  const bas = calculerPlan({ seau: 10, temps: 20, pression: 3, zones: ZONE });
  const haut = calculerPlan({ seau: 10, temps: 20, pression: 3.2, zones: ZONE });
  const buses = (p: { materiel: { nom: string; q: number }[] }) =>
    JSON.stringify(p.materiel.filter((m) => /buse/i.test(m.nom)));
  const attendu = Math.sqrt(haut.pressionAuxArroseurs / bas.pressionAuxArroseurs);
  const observe = haut.demande / bas.demande;
  dire(
    buses(bas) === buses(haut) && Math.abs(observe - attendu) < 0.005,
    `même buse à 3 et 3,2 bar : le débit suit √P (${observe.toFixed(4)} observé, ` +
      `${attendu.toFixed(4)} attendu)`,
  );

  // **La portée ne se GONFLE jamais.** L'exposant de la portée est une
  // estimation, pas un relevé de ses catalogues : l'appliquer vers le haut
  // ferait espacer les arroseurs sur un chiffre supposé, et un espacement trop
  // large est un trou d'arrosage qu'on ne découvre qu'en juillet. À très forte
  // pression, AUCUNE portée ne doit donc être corrigée : le calcul s'arrête à
  // celle du catalogue.
  dire(
    quadruple.porteeEstimee === false,
    "à 10 bar, aucune portée n'est gonflée au-delà de celle du catalogue",
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

// ── 11. AUCUN RÉSEAU NE DÉPASSE CE QUE LE TUYAU PASSE ───────────────────────
//
// **Sa déduction du 22 août 2026, et elle a trouvé un trou :** *« tu ne viens
// pas de me dire qu'en diamètre vingt-cinq c'était 1,76 m³/h ? Donc dans tous
// les cas le calcul doit se faire là-dessus, peu importe qu'on ait 2 ou 1,80. »*
//
// Il avait raison. Le découpage ne regardait que la SOURCE. Tant qu'elle reste
// modeste, elle commande et rien ne se voit — à 1,80 m³/h la limite était déjà
// 1,53. Mais dès qu'un artisan mesure 3 m³/h au seau, l'ancien calcul faisait
// des réseaux à 2,55 m³/h dans un tuyau qui n'en passe que 1,76 : l'eau y file
// à plus de 2 m/s, la ligne cogne, et la pression tombe avant le dernier
// arroseur. C'est le défaut qui ne se voit qu'en juillet.
{
  // **On monte la source jusqu'à l'absurde exprès** : c'est le seul régime où
  // le défaut existait, et une suite qui n'éprouve que son compteur à lui
  // n'aurait jamais rien vu.
  for (const secondes of [20, 12, 8, 4]) {
    const p = calculerPlan({
      seau: 10, temps: secondes, pression: 3,
      zones: [
        { type: "gazon", nom: "Grande pelouse", L: 30, l: 20 },
        { type: "gazon", nom: "Autre pelouse", L: 24, l: 14 },
      ],
    });
    const pire = Math.max(...p.secteurs.map((s: { debit: number }) => s.debit));
    dire(
      pire <= p.limiteDuTuyau + 1e-9,
      `source ${p.debitDisponible.toFixed(2)} m³/h : le pire réseau tire ${pire.toFixed(2)} ` +
        `pour ${p.limiteDuTuyau.toFixed(2)} que le Ø25 laisse passer`,
    );
  }

  // **Et l'écran doit pouvoir DIRE qui commande.** Un artisan qui mesure
  // 3 m³/h et voit ses réseaux plafonnés croirait à un défaut de calcul.
  const genereuse = calculerPlan({
    seau: 10, temps: 8, pression: 3, zones: [{ type: "gazon", L: 30, l: 20 }],
  });
  const modeste = calculerPlan({
    seau: 10, temps: 20, pression: 3, zones: [{ type: "gazon", L: 30, l: 20 }],
  });
  dire(
    genereuse.limitePar === "tuyau" && modeste.limitePar === "source",
    `source généreuse : « ${genereuse.limitePar} » commande · source modeste : « ${modeste.limitePar} »`,
  );
}

// ── LA PLUVIOMÉTRIE NE SÉPARE PLUS DEUX SECTEURS (23 août 2026) ─────────────
//
// **Sa décision, en trois mots :** *« ne prends pas en compte la
// pluviométrie »*. Elle était dans la clé de secteur depuis le 17 août, et
// c'est lui qui l'y avait mise — c'est donc lui qui l'en retire.
//
// **Ce que cette suite tient, c'est la BASCULE**, pas l'idée : deux pelouses de
// tailles très différentes reçoivent des buses différentes, donc des
// pluviométries différentes. Avant, elles ne pouvaient pas se retrouver sur la
// même vanne ; maintenant elles le peuvent. Si quelqu'un remettait la
// pluviométrie dans la clé, ce contrôle rougirait aussitôt.
//
// **Le jardin est choisi pour que la bascule se VOIE au niveau des têtes**, et
// pas seulement des groupes. Une petite pelouse et une grande reçoivent des
// buses différentes (0,75 et 1,0), et la coupe tombe au milieu : une vanne
// porte les deux. Sur d'autres jardins, les deux zones tombent bien dans le
// même groupe mais la coupe retombe sur leur limite — le contrôle passerait
// alors au vert sans rien avoir montré.
{
  const deuxBuses = calculerPlan({
    seau: 10, temps: 20, pression: 3, amenee: 30,
    zones: [
      { id: 1, type: "gazon", nom: "Petite", L: 6, l: 5 },
      { id: 2, type: "gazon", nom: "Grande", L: 20, l: 7 },
    ],
  });
  const busesParReseau = new Map<number, Set<string>>();
  for (const z of deuxBuses.dessin as { buse: string | null; points: { reseau?: number }[] }[]) {
    for (const pt of z.points) {
      if (pt.reseau === undefined) continue;
      if (!busesParReseau.has(pt.reseau)) busesParReseau.set(pt.reseau, new Set());
      busesParReseau.get(pt.reseau)!.add(z.buse ?? "?");
    }
  }
  const melange = [...busesParReseau.values()].some((b) => b.size > 1);
  dire(melange, "deux buses différentes peuvent partager une vanne — la pluviométrie ne coupe plus");

  // **Mais le MATÉRIEL sépare toujours.** Une turbine et une tuyère ne
  // s'ouvrent pas ensemble : l'une verse trois fois plus vite que l'autre, et
  // c'est une règle qu'il n'a pas retirée.
  const turbineEtTuyere = calculerPlan({
    seau: 10, temps: 12, pression: 3, compteur: "oui",
    zones: [
      { id: 1, type: "gazon", nom: "Grande", x: 0, y: 0, L: 14, l: 14 },
      { id: 2, type: "gazon", nom: "Couloir", x: 0, y: 14, L: 10, l: 3 },
    ],
  });
  const clesParReseau = new Map<number, Set<string>>();
  for (const z of turbineEtTuyere.dessin as { cle: string; points: { reseau?: number }[] }[]) {
    for (const pt of z.points) {
      if (pt.reseau === undefined) continue;
      if (!clesParReseau.has(pt.reseau)) clesParReseau.set(pt.reseau, new Set());
      clesParReseau.get(pt.reseau)!.add(z.cle);
    }
  }
  dire(
    [...clesParReseau.values()].every((c) => c.size === 1),
    "une turbine et une tuyère ne partagent JAMAIS une vanne — cette règle-là tient",
  );

  // ── UN SECTEUR NOMME LES ZONES QU'IL ARROSE ───────────────────────────────
  //
  // **Défaut révélé par le retrait de la pluviométrie, et par rien d'autre.**
  // Tant qu'elle coupait, un groupe ne portait qu'un modèle et retombait
  // presque toujours sur une seule zone : nommer le groupe entier revenait au
  // même. Depuis, deux pelouses de buses différentes tombent dans le même
  // groupe — et la coupe par points contigus peut retomber exactement sur leur
  // limite. L'écran annonçait « Devant + Derrière » pour une vanne qui n'arrose
  // que « Devant ». **Un plan qui nomme la mauvaise zone fait creuser au
  // mauvais endroit.**
  const surLaLimite = calculerPlan({
    seau: 10, temps: 20, pression: 3, amenee: 30,
    zones: [
      { id: 1, type: "gazon", nom: "Devant", L: 16, l: 6 },
      { id: 2, type: "gazon", nom: "Derrière", L: 15, l: 8 },
    ],
  });
  const noms = (surLaLimite.secteurs as { nom: string }[]).map((x) => x.nom);
  dire(
    noms.length === 2 && noms[0] === "Devant" && noms[1] === "Derrière",
    `chaque vanne nomme la zone qu'elle arrose, pas tout son groupe (${noms.join(" · ")})`,
  );
}

// ── « 13x », ET NON « 13 u » (23 août 2026) ─────────────────────────────────
//
// Sa demande : *« pour le calcul des pièces, 13x et pas 13 u »*. **L'unité
// reste dans les données** — c'est elle qui distingue une pièce qu'on compte
// d'un tuyau qu'on mesure. Seul le mot affiché change, et il change des deux
// côtés à la fois : la page publiée et l'application appellent la même
// fonction.
dire(quantiteEcrite(13, "u") === "13x", `13 pièces s’écrivent « ${quantiteEcrite(13, "u")} »`);
dire(quantiteEcrite(1, "u") === "1x", `une pièce s’écrit « ${quantiteEcrite(1, "u")} »`);
dire(
  quantiteEcrite(80, "ml") === "80 ml",
  `80 mètres restent des mètres : « ${quantiteEcrite(80, "ml")} » — « 80x de PE Ø25 » ne se commande pas`,
);

// ── 12. CE QUI ARRIVE AU DERNIER ARROSEUR ───────────────────────────────────
//
// **Sa demande du 22 août 2026 : « oui corrige la 1 ».** Jusque-là, seule
// l'amenée était comptée ; ce qui restait au pied du dernier arroseur d'une
// ligne — après l'électrovanne, la ligne, ses raccords et l'antenne Ø16 —
// n'était calculé nulle part. Un arroseur qui ne reçoit pas la pression de sa
// buse porte moins loin que le plan ne le suppose, et le coin qu'il devait
// atteindre jaunit en juillet.
{
  const JARDIN_PRESSION = {
    seau: 10, temps: 20, pression: 3, amenee: 30,
    zones: [
      { type: "gazon", nom: "Pelouse devant", L: 16, l: 6 },
      { type: "gazon", nom: "Pelouse derrière", L: 15, l: 8 },
    ],
  };
  const p = calculerPlan(JARDIN_PRESSION);

  dire(
    p.pressionAuxArroseurs > 0 && p.pressionAuxArroseurs < 3,
    `3 bar à la source, ${p.pressionAuxArroseurs.toFixed(2)} au dernier arroseur`,
  );

  // **L'arithmétique doit se REFAIRE À LA MAIN** (`CLAUDE.md` §4 bis) : deux
  // chiffres d'un même écran qui ne se recomposent pas, c'est toute la liste
  // dont on cesse de douter à raison.
  dire(
    Math.abs(3 - p.perteAmenee - p.perteReseau - p.pressionAuxArroseurs) < 1e-9,
    `3 − ${p.perteAmenee.toFixed(3)} − ${p.perteReseau.toFixed(3)} = ${p.pressionAuxArroseurs.toFixed(3)}`,
  );

  // **Le réseau perd plus que l'amenée**, et c'est bien pour ça que l'ignorer
  // était le trou : l'électrovanne seule pèse plus que trente mètres de Ø25.
  dire(
    p.perteReseau > p.perteAmenee,
    `le réseau perd ${p.perteReseau.toFixed(2)} bar, l'amenée ${p.perteAmenee.toFixed(2)}`,
  );

  // ── LE DÉBIT DÉCROÎT LE LONG DE LA LIGNE : UNE VALEUR DE RÉFÉRENCE ────────
  //
  // Entre la vanne et la première tête passe le débit du réseau entier ; entre
  // la première et la deuxième, ce débit moins une tête. Compter le débit
  // total sur toute la longueur — le raccourci tentant — donne **0,77 bar au
  // lieu de 0,44** sur ce jardin : assez pour condamner des plans qui
  // tiennent, et un avertissement qui parle à tort s'apprend à être ignoré.
  //
  // **Une borne large ne prouvait rien.** La première version de ce contrôle
  // exigeait « moins du double du pire débit » : les deux versions du calcul,
  // la juste et la fausse, y passaient au vert. Il a fallu injecter le défaut
  // pour s'en apercevoir (`CLAUDE.md` §5 — un contrôle qui n'a jamais échoué
  // ne prouve rien).
  //
  // On fige donc la VALEUR, à cinq millièmes de bar près. C'est volontairement
  // sévère : ce chiffre décide du nombre d'arroseurs par ligne, et il n'a pas
  // le droit de bouger en silence (`CLAUDE.md` §4 ter). S'il change pour une
  // bonne raison — une constante relevée chez son fournisseur, une formule
  // corrigée — cette ligne se met à jour SCIEMMENT, avec la raison en commit.
  //
  // **ELLE A BOUGÉ LE 23 AOÛT 2026, DE 0,442 À 0,436**, et voici la raison —
  // sans elle, cette ligne serait un simple re-calage, exactement ce que le
  // commentaire ci-dessus interdit.
  //
  // Le patron a retiré la pluviométrie de la clé de secteur (*« ne prends pas
  // en compte la pluviométrie »*, `ARCHITECTURE.md` §150). Sur CE jardin, les
  // deux pelouses reçoivent des buses différentes — 0,75 devant, 1,5 derrière :
  //
  //   avant : « Devant » 0,96 · « Derrière » 1,50   → deux secteurs séparés
  //   après : « Devant + Derrière » 0,94 et 1,47    → les deux mêlées
  //
  // La coupe n'est plus au même endroit, donc la ligne la plus chargée ne porte
  // plus le même débit, donc elle ne perd plus la même chose. **Vérifié en
  // remettant la pluviométrie dans la clé : la valeur redevient 0,442.** Ce
  // n'est pas la formule qui a changé, c'est le jardin qu'on lui donne.
  const PERTE_RESEAU_ATTENDUE = 0.436;
  dire(
    Math.abs(p.perteReseau - PERTE_RESEAU_ATTENDUE) < 0.005,
    `la perte du réseau vaut ${p.perteReseau.toFixed(3)} bar (${PERTE_RESEAU_ATTENDUE} attendu — ` +
      "0,773 si le débit ne décroissait pas le long de la ligne)",
  );

  // **Une pression de source trop faible se DIT, et ne se rattrape pas.**
  const faible = calculerPlan({ ...JARDIN_PRESSION, pression: 1 });
  dire(
    faible.pressionTropBasse === true,
    `1 bar à la source : l'outil alerte (${faible.pressionAuxArroseurs.toFixed(2)} bar au bout)`,
  );
  dire(
    p.pressionTropBasse === false,
    "3 bar à la source : aucune alerte — un avertissement qui parle à tort s'apprend à être ignoré",
  );

  // **LA GLOBALE NE DOIT PAS SURVIVRE À L'APPEL** — et c'est gardé DEUX fois :
  // `decouper` repart de la source à chaque passe 1, et `calculerPlan` remet à
  // zéro dans son `finally`. Ce contrôle ne rougit donc que si les deux sautent
  // ensemble ; retirer l'une des deux ne le fait pas broncher, et il a fallu
  // l'essayer pour le savoir.
  //
  // **On le garde en le disant.** C'est une défense en profondeur, pas une
  // sentinelle : le prétendre serait pire que de l'avoir retiré. Ce qu'il tient
  // vraiment, c'est qu'aucun troisième chemin n'introduise la fuite plus tard —
  // sur un serveur, deux artisans calculent en même temps.
  calculerPlan({ seau: 10, temps: 20, pression: 1.2, zones: [{ type: "gazon", L: 30, l: 20 }] });
  const apresUnAutre = calculerPlan(JARDIN_PRESSION);
  dire(
    Math.abs(apresUnAutre.pressionAuxArroseurs - p.pressionAuxArroseurs) < 1e-9,
    `un jardin à 1,2 bar intercalé ne déteint pas sur le suivant ` +
      `(${apresUnAutre.pressionAuxArroseurs.toFixed(3)} bar)`,
  );
}

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
