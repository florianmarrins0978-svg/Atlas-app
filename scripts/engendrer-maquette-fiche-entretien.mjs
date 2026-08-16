#!/usr/bin/env node
/*
  Engendre les deux planches de la FICHE D'ENTRETIEN, à partir d'une seule
  liste de prestations.

  **Pourquoi un script plutôt que deux fichiers écrits à la main.** Les deux
  planches montrent la MÊME fiche : celle qu'on coche sur le chantier, et le
  rapport qui en sort chez le client. Recopiées, les deux listes finiraient par
  diverger — et l'écart se verrait précisément là où le patron compare les deux.
  C'est la règle du §3 du dépôt, appliquée à des maquettes.

  Aucun `<script>` dans ce qui est produit : le lecteur du patron n'exécute pas
  JavaScript, et les pages bâties en JS lui arrivent VIDES (`PROJECT_STATE.md`).
  Tout ce qui réagit au doigt est fait de `input` natifs et de CSS.

  Contrôle : `scripts/verifier-maquette-fiche-entretien.mjs`.
*/

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "maquettes");

// La liste est relevée de SA capture, mot pour mot.
// Ne rien inventer ici : une prestation qui n'existe pas chez lui ferait juger
// la maquette sur un contenu qu'il ne reconnaît pas.
//
// `fait` porte ce qu'il a réellement coché ce jour-là : quatre lignes.
// C'est ce rapport-là — quatre faits, seize non — qui rend le défaut de
// l'autre application visible : sa fiche affiche surtout des « Faux ».
const FAMILLES = [
  {
    nom: "Pelouse",
    lignes: [
      { nom: "Tonte et ébarbage", fait: true },
      { nom: "Traitement pelouse", fait: false },
      { nom: "Scarification", fait: false },
      { nom: "Engrais", fait: false },
    ],
  },
  {
    nom: "Tailles",
    lignes: [
      { nom: "Taille arbuste automne", fait: false },
      { nom: "Taille arbuste printemps", fait: false },
      { nom: "Taille de haie automne", fait: false },
      { nom: "Taille de haie printemps", fait: false },
      { nom: "Taille des rosiers", fait: false },
    ],
  },
  {
    nom: "Massifs",
    lignes: [
      { nom: "Bêchage", fait: false },
      { nom: "Bordures massifs", fait: false },
      { nom: "Griffage massifs", fait: true },
      { nom: "Désherbage massifs", fait: false },
      { nom: "Coupe des fleurs fanées", fait: false },
    ],
  },
  {
    nom: "Propreté",
    lignes: [
      { nom: "Nettoyage pied de haies", fait: false },
      { nom: "Désherbant allée", fait: false },
      { nom: "Lierre, liseron, liane", fait: false },
      { nom: "Démoussage voirie", fait: false },
      { nom: "Ramassage des feuilles", fait: true },
      { nom: "Évacuation des déchets", fait: true },
    ],
  },
];

const TOUTES = FAMILLES.flatMap((f) => f.lignes);
const FAITES = TOUTES.filter((l) => l.fait);
const NON_FAITES = TOUTES.length - FAITES.length;

// Les comptes s'écrivent depuis la liste, jamais à la main : la première
// version disait « dix-huit » là où il y en a vingt, et un chiffre faux dans
// une maquette fait douter de tout ce qu'elle montre.
const EN_LETTRES = {
  4: "quatre", 5: "cinq", 6: "six", 16: "seize", 18: "dix-huit", 20: "vingt",
};
const mot = (n) => EN_LETTRES[n] ?? String(n);
const TOTAL_MOT = mot(TOUTES.length);
const FAITES_MOT = mot(FAITES.length);
const NON_MOT = mot(NON_FAITES);

const CHARTE = `
  :root{
    --fond:#efece6; --encre:#1c1c1a; --gris:#8a8578; --or:#B98B47;
    --trait:rgba(28,28,26,.13); --papier:#faf9f5; --pin:#2f3b2f;
    --alerte:#9C3B2E; --teinte:#ece9e1;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --fond:#171613; --encre:#e9e5dc; --gris:#8a867c; --or:#C9A15E;
      --trait:rgba(233,229,220,.16); --papier:#201e1a; --pin:#7d9179;
      --alerte:#C87058; --teinte:#252320;
    }
  }
  :root[data-theme="dark"]{
    --fond:#171613; --encre:#e9e5dc; --gris:#8a867c; --or:#C9A15E;
    --trait:rgba(233,229,220,.16); --papier:#201e1a; --pin:#7d9179;
    --alerte:#C87058; --teinte:#252320;
  }

  *{box-sizing:border-box}
  body{margin:0;background:var(--fond);color:var(--encre);
       font:16px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;
       padding:26px 18px 70px}
  .dedans{max-width:940px;margin:0 auto}
  h1{font-family:Georgia,"Times New Roman",serif;font-weight:400;
     font-size:27px;line-height:1.2;margin:0 0 8px}
  .intro{color:var(--gris);font-size:14px;line-height:1.65;margin:0 0 18px}
  .intro b{color:var(--encre);font-weight:600}
  .dit{margin:0 0 22px;padding:14px 16px;border-left:3px solid var(--or);
       background:var(--papier);font-size:14px;line-height:1.7;color:var(--gris)}
  .dit b{color:var(--encre);font-weight:600}

  .etat{position:absolute;opacity:0;pointer-events:none}
  .reglage{margin:0 0 18px}
  .reglage .quoi{display:block;font-size:11px;letter-spacing:.13em;
                 text-transform:uppercase;color:var(--or);margin-bottom:8px}
  .segments{display:flex;flex-wrap:wrap;gap:8px}
  .segments label{display:inline-block;padding:9px 15px;border-radius:999px;
                  border:1px solid var(--trait);background:var(--papier);
                  font-size:13.5px;cursor:pointer;color:var(--gris)}

  .rangee{display:flex;flex-wrap:wrap;gap:26px;align-items:flex-start}
  .tel{width:330px;flex:none;border-radius:26px;background:var(--papier);
       border:1px solid var(--trait);padding:16px 15px 20px;
       box-shadow:0 10px 34px rgba(28,28,26,.09)}
  .barre{display:flex;justify-content:space-between;align-items:baseline;
         margin-bottom:12px}
  .barre .ou{font-size:11px;letter-spacing:.13em;text-transform:uppercase;
             color:var(--or)}
  .barre .quand{font-size:11.5px;color:var(--gris)}
  .titre-fiche{font-family:Georgia,serif;font-size:20px;margin:0 0 2px}
  .sous{font-size:12.5px;color:var(--gris);margin:0 0 14px}

  .legende{flex:1;min-width:280px;font-size:13.5px;line-height:1.7;color:var(--gris)}
  .legende .t{display:block;font-family:Georgia,serif;font-size:18px;
              color:var(--encre);margin-bottom:8px}
  .legende b{color:var(--encre);font-weight:600}
  .cout{display:block;margin-top:12px;padding-top:12px;border-top:1px solid var(--trait)}

  .note{margin-top:30px;padding:16px 18px;border-radius:12px;
        background:var(--papier);font-size:13.5px;line-height:1.7;color:var(--gris)}
  .note b{color:var(--encre);font-weight:600}
  .note .t{display:block;font-size:11px;letter-spacing:.13em;
           text-transform:uppercase;color:var(--or);margin-bottom:8px}
  .note ul{margin:8px 0 0;padding-left:19px}
  .note li{margin-bottom:6px}
`;

/* ── Planche 62 : ce qu'il coche sur le chantier ─────────────────────────── */

function lignesACocher(prefixe, avecFamilles) {
  let n = 0;
  const bloc = (f) => {
    const lignes = f.lignes
      .map((l) => {
        const id = `${prefixe}${n++}`;
        return `      <input type="checkbox" id="${id}" class="etat"${l.fait ? " checked" : ""}>
      <label class="pres" for="${id}"><span class="case"></span><span class="mot">${l.nom}</span></label>`;
      })
      .join("\n");
    if (!avecFamilles) return lignes;
    const combien = f.lignes.filter((l) => l.fait).length;
    return `      <p class="fam">${f.nom}<span class="compte">${combien}/${f.lignes.length}</span></p>\n${lignes}`;
  };
  return FAMILLES.map(bloc).join("\n");
}

function lignesTroisEtats() {
  let n = 0;
  return FAMILLES.map((f) => {
    const lignes = f.lignes
      .map((l) => {
        const g = `t${n++}`;
        const coche = (suffixe, mot, choisi) =>
          `<input type="radio" name="${g}" id="${g}-${suffixe}" class="etat"${choisi ? " checked" : ""}>` +
          `<label class="tri-c tri-${suffixe}" for="${g}-${suffixe}">${mot}</label>`;
        return `      <div class="tri">
        <span class="mot">${l.nom}</span>
        <span class="choix">${coche("f", "Fait", l.fait)}${coche("n", "Non", !l.fait)}${coche("s", "S.O.", false)}</span>
      </div>`;
      })
      .join("\n");
    return `      <p class="fam">${f.nom}</p>\n${lignes}`;
  }).join("\n");
}

const PLANCHE_FICHE = `<title>La fiche d'entretien</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  /*
    LA FICHE D'ENTRETIEN — ce que le paysagiste coche sur le chantier.

    LE PATRON, LE 16 AOÛT 2026, captures d'une AUTRE application à l'appui :
    « c'est des fiches de chantier pour les paysagistes qui font de l'entretien
    […] une fiche où ils cochent ce qu'ils ont fait ou non sur le chantier, et
    ensuite qu'ils peuvent enregistrer et envoyer directement au client. »

    ————————————————————————————————————————————————————————————————
    CE QUE LA CAPTURE DE L'AUTRE APPLICATION APPREND — et qu'il ne faut pas
    recopier.

    Sa fiche affiche les ${TOTAL_MOT} prestations avec, sous chacune, « Vrai » ou
    « Faux ». Sur ce chantier-là, ${FAITES_MOT.toUpperCase()} sont faites et ${NON_MOT.toUpperCase()} ne le sont pas :
    l'écran est donc un mur de « Faux » qu'il faut faire défiler trois fois pour
    trouver les quatre lignes qui comptent. « Vrai » et « Faux » sont en outre
    des mots de programmeur — personne ne dit « faux » d'une haie qu'il n'a pas
    taillée.

    C'est le vrai enjeu de cette planche : ${TOTAL_MOT} lignes tiennent-elles au
    pouce, sur un chantier, avec des gants ?

    ————————————————————————————————————————————————————————————————
    CE QUI N'EST PAS À CHOISIR — ce sont des conséquences, pas des goûts.

    · LA LISTE VIENT DU CONTRAT, jamais d'une saisie libre. Un client qui paie
      la tonte et le ramassage n'a pas à voir douze lignes qui ne le concernent
      pas, et le paysagiste n'a pas à les cocher « non » chaque passage.
    · CE QUI N'A PAS ÉTÉ FAIT N'EST PAS UNE FAUTE. Une haie ne se taille pas en
      juillet. L'écran ne doit donc jamais peindre en rouge ce qui n'est pas
      coché — c'est le calendrier du métier, pas un manquement.
    · L'ENVOI PASSE PAR LE CHEMIN QUI EXISTE DÉJÀ. Atlas sait déjà porter un
      document jusqu'au client par SMS ou par e-mail, avec une page publique et
      un PDF (le devis, la facture). Le rapport emprunterait le même — rien à
      réinventer, et une seule plomberie à tenir.

    ————————————————————————————————————————————————————————————————
    RIEN N'EST CODÉ : \`src/\` n'est pas touché (règle du §3 bis).
    AUCUN SCRIPT : les cases et les bascules sont des \`input\` natifs.
    Engendré par \`scripts/engendrer-maquette-fiche-entretien.mjs\`.
    Contrôle : \`scripts/verifier-maquette-fiche-entretien.mjs\`.
  */
${CHARTE}
  .fa,.fb,.fc{display:none}
  #g-a:checked ~ .dedans .fa,
  #g-b:checked ~ .dedans .fb,
  #g-c:checked ~ .dedans .fc{display:block}
  #g-a:checked ~ .dedans label[for="g-a"],
  #g-b:checked ~ .dedans label[for="g-b"],
  #g-c:checked ~ .dedans label[for="g-c"]{background:var(--pin);color:var(--papier);
                                          border-color:var(--pin)}

  /* Une prestation = une ligne entière touchable. 52 px de haut : c'est la
     mesure d'un doigt ganté, pas d'un curseur. */
  .pres{display:flex;align-items:center;gap:12px;min-height:52px;
        padding:6px 4px;border-bottom:1px solid var(--trait);cursor:pointer}
  .pres .case{width:24px;height:24px;flex:none;border-radius:7px;
              border:1.5px solid var(--trait);background:transparent}
  .pres .mot{font-size:15px;color:var(--gris)}
  .etat:checked + .pres .case{background:var(--pin);border-color:var(--pin);
                              box-shadow:inset 0 0 0 3px var(--papier),
                                         inset 0 0 0 4px var(--pin)}
  .etat:checked + .pres .mot{color:var(--encre);font-weight:600}

  .fam{margin:16px 0 2px;font-size:11px;letter-spacing:.13em;
       text-transform:uppercase;color:var(--or);display:flex;
       justify-content:space-between;align-items:baseline}
  .fam .compte{font-size:11px;color:var(--gris);letter-spacing:0}

  /* Trois états : fait, non fait, sans objet. */
  .tri{display:flex;align-items:center;justify-content:space-between;gap:10px;
       min-height:52px;border-bottom:1px solid var(--trait);padding:6px 2px}
  .tri .mot{font-size:14.5px;color:var(--gris);flex:1;min-width:0}
  .choix{display:flex;gap:4px;flex:none}
  .tri-c{padding:7px 9px;border-radius:8px;border:1px solid var(--trait);
         font-size:11.5px;color:var(--gris);cursor:pointer;background:transparent}
  .etat:checked + .tri-f{background:var(--pin);border-color:var(--pin);color:var(--papier)}
  .etat:checked + .tri-n{background:var(--teinte);color:var(--encre)}
  .etat:checked + .tri-s{background:var(--teinte);color:var(--encre)}

  .fin{margin-top:18px;border-top:1px solid var(--trait);padding-top:14px}
  .champ-nom{margin:12px 0 5px;font-size:11px;letter-spacing:.13em;
             text-transform:uppercase;color:var(--or);display:flex;
             justify-content:space-between;align-items:baseline}
  .champ-nom .prevu{font-size:11px;letter-spacing:0;color:var(--gris);
                    text-transform:none}
  .saisie{display:flex;align-items:center;gap:9px}
  .saisie input{flex:1;min-width:0;font:inherit;font-size:16px;color:var(--encre);
                background:transparent;border:1px solid var(--trait);
                border-radius:10px;padding:11px 12px}
  .saisie .ecart{flex:none;font-size:12px;color:var(--pin);
                 background:var(--teinte);border-radius:999px;padding:5px 10px}
  .bouton{display:block;margin-top:16px;text-align:center;padding:15px;
          border-radius:999px;background:var(--pin);color:var(--papier);
          font-size:15px}
</style>

<input type="radio" name="g" id="g-a" class="etat">
<input type="radio" name="g" id="g-b" class="etat" checked>
<input type="radio" name="g" id="g-c" class="etat">

<div class="dedans">
  <h1>La fiche d'entretien</h1>
  <p class="intro">Votre demande du 16 août, d'après vos captures. <b>Rien n'est
    codé</b> — c'est votre règle. <b>Touchez les trois gestes</b>, et cochez
    les lignes : tout réagit.</p>

  <p class="dit">« Des fiches de chantier pour les paysagistes qui font de
    l'entretien […] <b>une fiche où ils cochent ce qu'ils ont fait ou non</b> sur
    le chantier, et ensuite qu'ils peuvent <b>enregistrer et envoyer directement
    au client</b>. »</p>

  <div class="reglage">
    <span class="quoi">Le geste sur le chantier</span>
    <div class="segments">
      <label for="g-a">A · La liste, d'un bloc</label>
      <label for="g-b">B · Rangée par familles — <b>retenu</b></label>
      <label for="g-c">C · Fait / non / sans objet</label>
    </div>
  </div>

  <div class="rangee">
    <div class="tel">
      <div class="barre"><span class="ou">Entretien</span><span class="quand">Mer. 22 juillet</span></div>
      <p class="titre-fiche">Monsieur Martins</p>
      <p class="sous">12 rue des Lilas — passage n° 7 sur 12</p>

      <div class="fa">
${lignesACocher("a", false)}
      </div>
      <div class="fb">
${lignesACocher("b", true)}
      </div>
      <div class="fc">
${lignesTroisEtats()}
      </div>

      <div class="fin">
        <p class="champ-nom">Temps passé <span class="prevu">planifié 2 h 30</span></p>
        <div class="saisie">
          <input type="text" value="1 h 40" aria-label="Temps passé sur le chantier">
          <span class="ecart">− 50 min</span>
        </div>

        <p class="champ-nom">Observations</p>
        <div class="saisie"><input type="text" value="" placeholder="Rien à signaler" aria-label="Observations"></div>

        <span class="bouton">Enregistrer et envoyer</span>
      </div>
    </div>

    <div class="legende">
      <div class="fa">
        <span class="t">A · La liste, d'un bloc</span>
        Les ${TOTAL_MOT} lignes à la suite, dans l'ordre du contrat. Une ligne
        entière se touche — <b>52 px de haut</b>, la mesure d'un doigt ganté.
        <span class="cout">Ce que ça coûte : <b>trois écrans à faire défiler</b>
        pour cocher quatre lignes. C'est exactement ce que fait l'autre
        application, et c'est ce qui la rend pénible sur un chantier.</span>
      </div>
      <div class="fb">
        <span class="t">B · Rangée par familles</span>
        Pelouse, Tailles, Massifs, Propreté. Chaque famille porte son compte
        — <b>« 1/4 »</b> — et se lit d'un coup d'œil sans rien ouvrir.
        <span class="cout">Ce que ça coûte : un niveau de plus à comprendre.
        En échange, il retrouve ses gestes dans l'ordre où il les fait, et le
        compte lui dit s'il a oublié une famille entière.</span>
      </div>
      <div class="fc">
        <span class="t">C · Fait / non / sans objet</span>
        Trois réponses au lieu de deux. <b>« Sans objet »</b> dit quelque chose
        qu'une case vide ne dit pas : la haie n'était pas à tailler ce mois-ci,
        ce n'est pas un oubli.
        <span class="cout">Ce que ça coûte : <b>trois fois plus de gestes</b>,
        et une décision à prendre sur chaque ligne — y compris les quatorze qui
        ne le concernent pas ce jour-là. À ne retenir que si la distinction
        compte pour le client.</span>
      </div>
    </div>
  </div>

  <div class="note">
    <span class="t">Retenu le 16 août 2026</span>
    <ul>
      <li><b>B — rangée par familles.</b> Sa réponse, en un mot : « B et B ».</li>
      <li><b>Le temps passé se saisit à la main</b>, sur la fiche, à la fin du
        passage. Le temps PLANIFIÉ est rappelé à côté, en petit, et l'écart se
        calcule tout seul — c'est ce que fait déjà l'autre application, et c'est
        ce qui vous dit si le contrat est bien taillé.</li>
      <li><b>Les observations restent un champ libre</b> : c'est là que se note
        « portail à réparer », et c'est ce que le client lira.</li>
    </ul>
  </div>

  <div class="note">
    <span class="t">Ce qui n'est pas à choisir</span>
    <ul>
      <li><b>La liste vient du contrat</b>, jamais d'une saisie libre : un client
        qui paie la tonte et le ramassage n'a pas à voir douze lignes qui ne le
        concernent pas.</li>
      <li><b>Ce qui n'est pas coché n'est pas une faute.</b> Une haie ne se
        taille pas en juillet — aucun rouge sur ces lignes.</li>
      <li><b>L'envoi emprunte le chemin qui existe déjà</b> : le SMS ou l'e-mail,
        la page publique et le PDF qui portent déjà vos devis et vos factures.
        Rien à réinventer.</li>
    </ul>
  </div>
</div>
`;

/* ── Planche 63 : ce que le client reçoit ────────────────────────────────── */

const lignesRapport = (garder) =>
  FAMILLES.map((f) => {
    const lignes = f.lignes.filter(garder);
    if (lignes.length === 0) return "";
    return (
      `      <p class="fam">${f.nom}</p>\n` +
      lignes
        .map(
          (l) =>
            `      <div class="rl${l.fait ? "" : " non"}"><span class="v">${l.fait ? "✓" : "·"}</span><span>${l.nom}</span></div>`
        )
        .join("\n")
    );
  })
    .filter(Boolean)
    .join("\n");

const PLANCHE_RAPPORT = `<title>Le rapport que reçoit le client</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  /*
    LE RAPPORT QUE REÇOIT LE CLIENT — la sortie de la fiche d'entretien.

    LA QUESTION, ET ELLE N'EST PAS DE MISE EN PAGE. Sur ce passage, ${FAITES_MOT.toUpperCase()}
    prestations sur ${TOTAL_MOT} ont été faites. Que voit le client ?

    L'AUTRE APPLICATION LUI MONTRE LES ${TOTAL_MOT.toUpperCase()}, avec « Vrai » ou « Faux »
    sous chacune. Le client ouvre un document où il lit ${NON_MOT.toUpperCase()} FOIS « Faux »
    — et il paie pour ce passage. Aucun paysagiste ne rédigerait ça à la main.

    Mais tout cacher a un coût inverse, et il est réel : un client qui ne voit
    que ${FAITES_MOT} lignes peut croire que son contrat n'en couvre que quatre, et
    s'étonner du prix. Ce que le silence économise en gêne, il le perd en
    justification.

    ————————————————————————————————————————————————————————————————
    CE QUI N'EST PAS À CHOISIR.

    · « VRAI » ET « FAUX » NE SORTENT PAS. Ce sont des mots de programmeur.
    · LE DOCUMENT PORTE LA DATE, LE CHANTIER ET LE TEMPS PASSÉ — c'est ce qui
      en fait une preuve de passage, et c'est ce que le client garde.
    · IL N'Y A PLUS DE SIGNATURE, ET C'EST DÉCIDÉ (16 août 2026). Sur SA propre
      capture de l'autre application, les deux signatures sont « Non signé » —
      la sienne et celle du client. Le client est absent onze fois sur douze : il
      travaille pendant qu'on entretient son jardin, et un champ qui reste vide
      fait passer chaque rapport pour un document inachevé.
      Ce qui prouve le passage à leur place existe déjà : la date, l'heure, le
      temps passé, et l'EMPREINTE du contenu exact — le mécanisme qui sert déjà
      à l'acceptation d'un devis (empreinteDevis). Plus solide qu'un trait au
      doigt, et sans aucun geste à faire.
    · UN RAPPORT SANS SIGNATURE NE DOIT PAS AVOIR L'AIR INCOMPLET. Si personne
      n'a signé, la ligne n'existe pas — jamais de « Non signé » en gris au bas
      d'un document qui part chez un client.

    ————————————————————————————————————————————————————————————————
    RIEN N'EST CODÉ : \`src/\` n'est pas touché (règle du §3 bis).
    AUCUN SCRIPT. Engendré par \`scripts/engendrer-maquette-fiche-entretien.mjs\`.
    Contrôle : \`scripts/verifier-maquette-fiche-entretien.mjs\`.
  */
${CHARTE}
  .ra,.rb,.rc{display:none}
  #r-a:checked ~ .dedans .ra,
  #r-b:checked ~ .dedans .rb,
  #r-c:checked ~ .dedans .rc{display:block}
  #r-a:checked ~ .dedans label[for="r-a"],
  #r-b:checked ~ .dedans label[for="r-b"],
  #r-c:checked ~ .dedans label[for="r-c"]{background:var(--pin);color:var(--papier);
                                          border-color:var(--pin)}

  .fam{margin:15px 0 4px;font-size:11px;letter-spacing:.13em;
       text-transform:uppercase;color:var(--or)}
  .rl{display:flex;gap:10px;align-items:baseline;padding:7px 0;font-size:14.5px;
      border-bottom:1px solid var(--trait);color:var(--encre)}
  .rl .v{color:var(--pin);flex:none;width:14px}
  .rl.non{color:var(--gris)}
  .rl.non .v{color:var(--trait)}

  .replie{margin-top:14px;border-top:1px solid var(--trait);padding-top:12px}
  .replie .titre{font-size:12.5px;color:var(--gris)}
  .replie .liste{margin:6px 0 0;font-size:12.5px;color:var(--gris);line-height:1.75}

  .entete{border-bottom:1px solid var(--trait);padding-bottom:12px;margin-bottom:6px}
  .entete .qui{font-family:Georgia,serif;font-size:20px;margin:0}
  .entete .quoi2{font-size:12.5px;color:var(--gris);margin:2px 0 0}
  .preuve{margin-top:14px;padding-top:12px;border-top:1px solid var(--trait);
          font-size:11.5px;line-height:1.7;color:var(--gris)}
  .recu{display:block;margin-top:14px;text-align:center;padding:13px;
        border-radius:999px;border:1px solid var(--trait);
        font-size:14px;color:var(--encre)}
  .pied{margin-top:14px;font-size:12.5px;color:var(--gris);
        display:flex;justify-content:space-between}
  .pied b{color:var(--encre)}
</style>

<input type="radio" name="r" id="r-a" class="etat">
<input type="radio" name="r" id="r-b" class="etat" checked>
<input type="radio" name="r" id="r-c" class="etat">

<div class="dedans">
  <h1>Le rapport que reçoit le client</h1>
  <p class="intro">La sortie de la fiche. <b>${FAITES_MOT.charAt(0).toUpperCase()}${FAITES_MOT.slice(1)} prestations sur ${TOTAL_MOT}</b>
    ont été faites ce passage — c'est le vrai cas de votre capture.
    <b>Touchez les trois versions.</b></p>

  <p class="dit">L'autre application montre les ${TOTAL_MOT} lignes avec « Vrai » ou
    « Faux ». Votre client lirait donc <b>${NON_MOT} fois « Faux »</b> sur un
    passage qu'il paie.</p>

  <div class="reglage">
    <span class="quoi">Ce que le client voit</span>
    <div class="segments">
      <label for="r-a">A · Tout, comme l'autre</label>
      <label for="r-b">B · Seulement ce qui a été fait — <b>retenu</b></label>
      <label for="r-c">C · Ce qui a été fait, le reste replié</label>
    </div>
  </div>

  <div class="rangee">
    <div class="tel">
      <div class="entete">
        <div class="barre"><span class="ou">Rapport d'entretien</span><span class="quand">Mer. 22 juillet</span></div>
        <p class="qui">Monsieur Martins</p>
        <p class="quoi2">12 rue des Lilas — passage n° 7 sur 12</p>
      </div>

      <div class="ra">
${lignesRapport(() => true)}
      </div>
      <div class="rb">
${lignesRapport((l) => l.fait)}
      </div>
      <div class="rc">
${lignesRapport((l) => l.fait)}
        <div class="replie">
          <span class="titre">Non prévu à ce passage — ${NON_FAITES} prestations du contrat</span>
          <p class="liste">${TOUTES.filter((l) => !l.fait).map((l) => l.nom).join(" · ")}</p>
        </div>
      </div>

      <div class="pied"><span>Temps passé</span><b>1 h 40</b></div>
      <div class="preuve">
        Passage du mercredi 22 juillet, 08 h 00 – 09 h 15.<br>
        Rapport figé et horodaté par Arborea.
      </div>
      <span class="recu">J'ai bien reçu ce rapport</span>
    </div>

    <div class="legende">
      <div class="ra">
        <span class="t">A · Tout, comme l'autre application</span>
        Les ${TOTAL_MOT} lignes, faites ou non. Le contrat est visible en entier :
        le client sait ce qu'il paie.
        <span class="cout">Ce que ça coûte : <b>${NON_MOT} lignes éteintes sur
        ${TOTAL_MOT}</b>. Le document se lit comme un bulletin de notes, et ce qui a
        vraiment été fait se perd dedans.</span>
      </div>
      <div class="rb">
        <span class="t">B · Seulement ce qui a été fait</span>
        ${FAITES_MOT.charAt(0).toUpperCase()}${FAITES_MOT.slice(1)} lignes, lisibles d'un regard. C'est ce qu'un paysagiste écrirait
        de sa main sur un bon de passage.
        <span class="cout">Ce que ça coûte, et c'est réel : <b>le client ne voit
        plus l'étendue de son contrat</b>. ${FAITES_MOT.charAt(0).toUpperCase()}${FAITES_MOT.slice(1)} lignes pour le prix d'un
        passage complet peuvent faire douter — et vous vaudront l'appel.</span>
      </div>
      <div class="rc">
        <span class="t">C · Ce qui a été fait, le reste replié</span>
        Les ${FAITES_MOT} en clair, et dessous une seule phrase grise qui nomme les
        ${NON_MOT} autres : <b>« non prévu à ce passage »</b>.
        <span class="cout">Ce que ça coûte : une ligne de plus à lire. En
        échange, elle répond à l'appel avant qu'il ne soit passé — le client voit
        l'étendue du contrat sans lire ${NON_MOT} refus.</span>
      </div>
    </div>
  </div>

  <div class="note">
    <span class="t">Ce qui n'est pas à choisir</span>
    <ul>
      <li><b>« Vrai » et « Faux » ne sortent pas d'ici</b> : ce sont des mots de
        programmeur, pas les vôtres.</li>
      <li><b>La date, le chantier et le temps passé restent</b> : c'est ce qui
        fait du document une preuve de passage.</li>
      <li><b>Plus de signature — décidé le 16 août.</b> Sur votre propre capture,
        les deux étaient « Non signé ». Votre client est absent onze fois sur
        douze, et un champ vide fait passer le rapport pour inachevé.</li>
      <li><b>Ce qui prouve le passage à sa place</b> : la date, l'heure, le temps
        passé, et l'empreinte du contenu exact — le mécanisme qui sert déjà à
        l'acceptation d'un devis. Le bouton « J'ai bien reçu » est un accusé
        horodaté, pas une signature.</li>
    </ul>
  </div>
</div>
`;


/* ── Planche 64 : où il compose sa fiche, dans les Réglages ──────────────── */

const lignesModele = FAMILLES.map(
  (f, i) => `      <div class="fam-bloc">
        <p class="fam">${f.nom}<span class="retirer-fam">Renommer</span></p>
${f.lignes
  .map(
    (l, j) => `        <div class="mod${i === 3 && j === 3 ? " retiree" : ""}">
          <span class="poignee">⠿</span>
          <span class="nom">${l.nom}</span>
          <span class="croix">${i === 3 && j === 3 ? "Rétablir" : "×"}</span>
        </div>`
  )
  .join("\n")}
        <p class="ajouter">+ Ajouter une prestation</p>
      </div>`
).join("\n");

const PLANCHE_MODELE = `<title>Composer sa fiche d'entretien</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  /*
    COMPOSER SA FICHE — l'endroit, dans les Réglages, où la liste se fabrique.

    LE PATRON, LE 16 AOÛT 2026, après avoir choisi B et B : « dans les réglages,
    il faut créer une nouvelle case ou le ranger quelque part, un endroit où
    l'utilisateur pourra créer cette fiche. Donc on peut mettre déjà cette fiche
    en modèle, mais également il pourra la modifier, donc retirer ou ajouter des
    cases s'il le souhaite. »

    ————————————————————————————————————————————————————————————————
    TRANCHÉ LE 16 AOÛT 2026 — A, et ses mots valent mieux qu'un résumé :

      « Ça sera un modèle à chaque fois qu'on pré-remplira et qu'on enverra aux
      clients. Donc au final, chaque client aura sa fiche parce que ça ne sera
      jamais la même — d'un client à un autre on ne fait pas la même prestation
      — mais il n'y aura qu'une seule fiche. »

    UN SEUL MODÈLE, donc, tenu ici. Rien n'est rangé par client : à chaque
    passage, la fiche part du modèle, s'ajuste, et devient celle de ce client.

    CE QUE CELA SUPPOSE, ET QUI N'EST PAS UN DÉTAIL : le second passage chez le
    même client doit retrouver son ajustement, sinon il le referait douze fois
    par an. Le pré-remplissage se fait donc d'après SON DERNIER PASSAGE, et le
    modèle ne sert que la première fois. C'est la lecture retenue ; s'il en
    voulait une autre, un mot suffit à la corriger.

    ————————————————————————————————————————————————————————————————
    CE QUI N'EST PAS À CHOISIR — ce sont des conséquences.

    · UN RAPPORT DÉJÀ ENVOYÉ NE CHANGE PLUS. Retirer « Scarification » du modèle
      en octobre ne doit rien changer aux rapports de juillet : ils sont signés,
      ils sont partis chez le client, ce sont des preuves de passage. Le modèle
      décrit les passages À VENIR, jamais ceux qui ont eu lieu. C'est l'erreur
      qui ne se rattrape pas — un document déjà remis qui se réécrit tout seul.
    · LE RETRAIT EST RÉVERSIBLE, comme partout dans Atlas depuis le 10 août :
      la ligne se barre et se rétablit d'un geste, elle ne disparaît pas sous le
      doigt. « Démoussage voirie » est montrée retirée pour qu'on le voie.
    · LES FAMILLES SONT DE LUI. Pelouse, Tailles, Massifs, Propreté sont un
      point de départ, pas une nomenclature imposée : elles se renomment.

    ————————————————————————————————————————————————————————————————
    RIEN N'EST CODÉ : le dossier src/ n'est pas touché (règle du §3 bis).
    AUCUN SCRIPT. Engendré par scripts/engendrer-maquette-fiche-entretien.mjs
    Contrôle : scripts/verifier-maquette-fiche-entretien.mjs
  */
${CHARTE}
  .ma,.mb{display:none}
  #m-a:checked ~ .dedans .ma,
  #m-b:checked ~ .dedans .mb{display:block}
  #m-a:checked ~ .dedans label[for="m-a"],
  #m-b:checked ~ .dedans label[for="m-b"]{background:var(--pin);color:var(--papier);
                                          border-color:var(--pin)}

  .reglages{margin-bottom:8px}
  .reglages .r{display:flex;justify-content:space-between;align-items:center;
               padding:13px 2px;border-bottom:1px solid var(--trait);
               font-size:15px;color:var(--gris)}
  .reglages .r.neuf{color:var(--encre);font-weight:600}
  .reglages .r .fleche{color:var(--trait)}
  .reglages .r.neuf .fleche{color:var(--or)}

  .fam-bloc{margin-bottom:6px}
  .fam{margin:16px 0 2px;font-size:11px;letter-spacing:.13em;
       text-transform:uppercase;color:var(--or);display:flex;
       justify-content:space-between;align-items:baseline}
  .fam .retirer-fam{font-size:11px;letter-spacing:0;text-transform:none;
                    color:var(--gris)}
  .mod{display:flex;align-items:center;gap:10px;min-height:46px;
       border-bottom:1px solid var(--trait);font-size:14.5px;color:var(--encre)}
  .mod .poignee{color:var(--trait);flex:none}
  .mod .nom{flex:1;min-width:0}
  .mod .croix{flex:none;color:var(--gris);font-size:13px}
  .mod.retiree .nom{text-decoration:line-through;color:var(--gris)}
  .mod.retiree .croix{color:var(--or)}
  .ajouter{margin:9px 0 0;font-size:13.5px;color:var(--or)}

  .bouton{display:block;margin-top:18px;text-align:center;padding:15px;
          border-radius:999px;background:var(--pin);color:var(--papier);
          font-size:15px}
  .parclient{margin-top:14px;padding:12px 13px;border-radius:12px;
             background:var(--teinte);font-size:12.5px;color:var(--gris)}
  .parclient b{color:var(--encre)}
</style>

<input type="radio" name="m" id="m-a" class="etat" checked>
<input type="radio" name="m" id="m-b" class="etat">

<div class="dedans">
  <h1>Composer sa fiche d'entretien</h1>
  <p class="intro">Là où la liste se fabrique, dans les Réglages. <b>Rien n'est
    codé.</b> Une question reste, et elle n'est pas de rangement : <b>une seule
    fiche, ou une par client ?</b></p>

  <p class="dit">« Dans les réglages, un endroit où l'utilisateur pourra créer
    cette fiche. On peut mettre <b>déjà cette fiche en modèle</b>, mais également
    il pourra la modifier — <b>retirer ou ajouter des cases</b> s'il le
    souhaite. »</p>

  <div class="reglage">
    <span class="quoi">Une fiche, ou plusieurs ?</span>
    <div class="segments">
      <label for="m-a">A · Un seul modèle, pré-rempli à chaque envoi — <b>retenu</b></label>
      <label for="m-b">B · Un modèle, puis une fiche rangée par client</label>
    </div>
  </div>

  <div class="rangee">
    <div class="tel">
      <div class="barre"><span class="ou">Réglages</span><span class="quand">Arborea</span></div>
      <div class="reglages">
        <div class="r"><span>Mon identité</span><span class="fleche">›</span></div>
        <div class="r"><span>Mes équipes</span><span class="fleche">›</span></div>
        <div class="r"><span>Mes tarifs</span><span class="fleche">›</span></div>
        <div class="r neuf"><span>Ma fiche d'entretien</span><span class="fleche">›</span></div>
        <div class="r"><span>Mes documents</span><span class="fleche">›</span></div>
      </div>

      <p class="titre-fiche" style="margin-top:18px">Ma fiche d'entretien</p>
      <p class="sous ma">Le modèle. Chaque envoi part de là, puis s'ajuste au client.</p>
      <p class="sous mb">Le modèle. Chaque client part de là, puis s'ajuste.</p>

${lignesModele}

      <p class="ajouter">+ Ajouter une famille</p>

      <div class="mb parclient">
        <b>Monsieur Martins</b> — 14 prestations sur 20.<br>
        Retirées pour lui : Traitement pelouse, Scarification, Engrais,
        Désherbant allée, Démoussage voirie, Bêchage.
      </div>

      <span class="bouton">Enregistrer</span>
    </div>

    <div class="legende">
      <div class="ma">
        <span class="t">A · Un seul modèle, pré-rempli à chaque envoi</span>
        <b>Sa décision du 16 août 2026</b>, dans ses mots : « ça sera un modèle à
        chaque fois qu'on pré-remplira et qu'on enverra aux clients. Donc au
        final, chaque client aura sa fiche, parce que ça ne sera jamais la même
        — mais il n'y aura qu'une seule fiche. »
        <span class="cout"><b>Une seule liste à tenir</b>, ici, dans les
        Réglages. Rien n'est rangé par client : à chaque passage, la fiche part
        du modèle, s'ajuste sur place, et devient celle de ce client-là.
        <b>Ce que ça suppose</b>, et qui n'est pas un détail : le second passage
        chez le même client doit retrouver son ajustement, sinon il le referait
        douze fois par an. Le pré-remplissage se fait donc d'après SON dernier
        passage, et le modèle ne sert que la première fois.</span>
      </div>
      <div class="mb">
        <span class="t">B · Un modèle, puis une fiche rangée par client</span>
        <b>Écarté le 16 août.</b> 
        Le modèle sert de point de départ ; à la signature d'un contrat, on
        décoche ce que ce client ne prend pas. Sa fiche ne porte alors que ses
        prestations — quatorze au lieu de vingt.
        <span class="cout">Ce que ça coûte : <b>un geste de plus par client</b>,
        une fois, à la signature. Et une question à trancher : quand vous
        modifiez le modèle, les fiches déjà ajustées bougent-elles ? (Ma
        proposition : <b>non</b> — sinon un ajustement fait pour un client se
        déferait tout seul.)</span>
      </div>
    </div>
  </div>

  <div class="note">
    <span class="t">Ce qui n'est pas à choisir</span>
    <ul>
      <li><b>Un rapport déjà envoyé ne change plus jamais.</b> Retirer une ligne
        du modèle en octobre ne touche pas aux rapports de juillet : ils sont
        signés et partis chez le client. Le modèle décrit les passages À VENIR.
        C'est l'erreur qui ne se rattrape pas.</li>
      <li><b>Le retrait est réversible</b>, comme partout dans Atlas depuis le
        10 août : la ligne se barre et se rétablit. « Démoussage voirie »
        est montrée retirée pour que vous le voyiez.</li>
      <li><b>Les familles sont les vôtres</b> : Pelouse, Tailles, Massifs,
        Propreté sont un point de départ, pas une nomenclature imposée.</li>
    </ul>
  </div>
</div>
`;

writeFileSync(join(DOSSIER, "62-la-fiche-dentretien.html"), PLANCHE_FICHE);
writeFileSync(join(DOSSIER, "63-le-rapport-au-client.html"), PLANCHE_RAPPORT);
writeFileSync(join(DOSSIER, "64-composer-sa-fiche.html"), PLANCHE_MODELE);
console.log(
  `✅ Trois planches engendrées — ${TOUTES.length} prestations, dont ${FAITES.length} faites.`
);
