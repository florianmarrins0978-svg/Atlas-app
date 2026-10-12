// Scénario de charge Atlas : de vraies sessions connectées, par palier.
//
// Chaque utilisateur virtuel prend la session d'une des entreprises de charge
// (ouverte dans un vrai navigateur par `connecter.mts`) et enchaîne ce que fait
// un artisan : ouvrir la liste des chantiers, celle des clients, les terminés,
// le planning, un PDF. Entre deux écrans, il lit (1 à 3 s).
//
// Trois familles mesurées à part, par l'étiquette `page` :
//   liste    : /, /clients, /termines
//   planning : /planning
//   pdf      : /api/factures/exemple/pdf, /api/chantiers/<id>/fiche/pdf
//
// La séparation entre entreprises se vérifie SOUS charge : chaque réponse de
// liste ou de planning doit porter les chantiers de l'entreprise connectée et
// AUCUN de ceux d'une autre ; et la fiche PDF du chantier d'une autre
// entreprise doit être refusée.
//
// Usage : k6 run -e VUS=50 -e SESSIONS=<chemin sessions.json> qa/charge/scenario.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter } from "k6/metrics";
import { SharedArray } from "k6/data";

const BASE = __ENV.BASE || "http://localhost:3000";
const VUS = Number(__ENV.VUS || 10);
const MONTEE = __ENV.MONTEE || "30s";
const TENUE = __ENV.TENUE || "60s";

const sessions = new SharedArray("sessions", () => JSON.parse(open(__ENV.SESSIONS)));

const erreurs = new Rate("erreurs");
const violationsIsolation = new Counter("violations_isolation");

export const options = {
  scenarios: {
    palier: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: MONTEE, target: VUS },
        { duration: TENUE, target: VUS },
      ],
      gracefulRampDown: "10s",
      gracefulStop: "30s",
    },
  },
  // Les seuils ne servent qu'à faire apparaître les sous-mesures par famille
  // dans le résumé ; la décision d'arrêt se prend sur les chiffres, ailleurs.
  thresholds: {
    "http_req_duration{page:liste}": ["p(95)<1e9"],
    "http_req_duration{page:planning}": ["p(95)<1e9"],
    "http_req_duration{page:pdf}": ["p(95)<1e9"],
    "erreurs{page:liste}": ["rate<=1"],
    "erreurs{page:planning}": ["rate<=1"],
    "erreurs{page:pdf}": ["rate<=1"],
    "erreurs{page:isolation}": ["rate<=1"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
  discardResponseBodies: false,
};

function rangDe(nom) {
  return nom.replace("Paysages Charge ", "");
}

function obtenir(chemin, session, page, attendu) {
  const res = http.get(`${BASE}${chemin}`, {
    headers: { Cookie: session.cookie },
    tags: { page, name: chemin.replace(/[0-9a-f-]{36}/g, ":id") },
    timeout: "60s",
    redirects: 0,
  });
  const ok = check(res, {
    [`${page} : statut 200`]: (r) => r.status === 200,
    ...(attendu ? { [`${page} : contenu attendu`]: (r) => attendu(r) } : {}),
  });
  erreurs.add(!ok, { page });
  return res;
}

// Une liste ou un planning n'affiche que SES chantiers : « Jardin 07- » chez
// l'entreprise 07, jamais « Jardin 12- ».
function sansAutreEntreprise(res, rang) {
  if (res.status !== 200 || typeof res.body !== "string") return true;
  const autres = res.body.match(/Jardin (\d{2})-\d+/g) || [];
  const etrangers = autres.filter((m) => m.slice(7, 9) !== rang);
  if (etrangers.length > 0) violationsIsolation.add(etrangers.length);
  return etrangers.length === 0;
}

export default function () {
  const session = sessions[(__VU - 1) % sessions.length];
  const voisine = sessions[__VU % sessions.length];
  const rang = rangDe(session.nom);
  const tirage = Math.random();

  if (tirage < 0.5) {
    const ecran = ["/", "/clients", "/termines"][Math.floor(Math.random() * 3)];
    // /termines est vide pour ces entreprises (aucun chantier terminé) : seul
    // son statut se vérifie. Les deux autres doivent montrer SES noms, sinon
    // une page vide passerait pour « isolée ».
    const attendu = ecran === "/termines" ? null : (r) => typeof r.body === "string" && r.body.includes(` ${rang}-`);
    const res = obtenir(ecran, session, "liste", attendu);
    const propre = sansAutreEntreprise(res, rang);
    erreurs.add(!propre, { page: "isolation" });
  } else if (tirage < 0.8) {
    const res = obtenir("/planning", session, "planning", (r) => typeof r.body === "string" && r.body.includes(`Jardin ${rang}-`));
    const propre = sansAutreEntreprise(res, rang);
    erreurs.add(!propre, { page: "isolation" });
  } else if (tirage < 0.9) {
    obtenir("/api/factures/exemple/pdf", session, "pdf", (r) => String(r.headers["Content-Type"]).includes("pdf"));
  } else {
    const id = session.chantierIds[Math.floor(Math.random() * session.chantierIds.length)];
    obtenir(`/api/chantiers/${id}/fiche/pdf`, session, "pdf", (r) => String(r.headers["Content-Type"]).includes("pdf"));
    // Et la fiche d'un chantier d'une AUTRE entreprise : elle doit être refusée.
    if (voisine.entrepriseId !== session.entrepriseId) {
      const etranger = voisine.chantierIds[0];
      const res = http.get(`${BASE}/api/chantiers/${etranger}/fiche/pdf`, {
        headers: { Cookie: session.cookie },
        tags: { page: "isolation", name: "/api/chantiers/:autre/fiche/pdf" },
        timeout: "60s",
        redirects: 0,
      });
      const refuse = res.status !== 200 || !String(res.headers["Content-Type"]).includes("pdf");
      if (!refuse) violationsIsolation.add(1);
      erreurs.add(!refuse, { page: "isolation" });
    }
  }

  sleep(1 + Math.random() * 2);
}
