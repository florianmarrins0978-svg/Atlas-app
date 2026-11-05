import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * UNE FAUSSE PLATEFORME AGRÉÉE, qui suit les contrats de l'API commune
 * (AFNOR XP Z12-013 1.3.0, annexe A) — pour éprouver le branchement sans
 * compte, et sans rien envoyer à personne.
 *
 * Elle sait se comporter comme une vraie dans les cas qui comptent :
 *
 * | `mode` | ce qu'elle fait |
 * |---|---|
 * | `accepte` | rend un jeton, un `flowId`, puis `Ok` à la relecture |
 * | `refuse` | prend le dépôt, puis le refuse au contrôle (`Error`, avec sa raison) |
 * | `rejette` | refuse le dépôt sur-le-champ (422, avec sa raison) |
 * | `muette` | répond 503 à tout |
 * | `revoque` | refuse les identifiants (401) |
 *
 * **Elle vérifie ce qu'on lui envoie** — un jeton, le multipart, le
 * `flowInfo` en JSON, un vrai PDF — et garde chaque dépôt : une suite peut
 * relire ce qui est vraiment parti.
 */

export type ModeFaussePlateforme = "accepte" | "refuse" | "rejette" | "muette" | "revoque";
export type DepotRecu = { flowId: string; flowInfo: Record<string, unknown>; fichier: Buffer };

export type FaussePlateforme = {
  adresseFlux: string;
  adresseJeton: string;
  depots: DepotRecu[];
  mode: ModeFaussePlateforme;
  fermer: () => Promise<void>;
};

const IDENTIFIANT = "atlas-essai";
const SECRET = "secret-essai";
const JETON = "jeton-essai";

export const IDENTIFIANTS_DE_LA_FAUSSE_PLATEFORME = { identifiant: IDENTIFIANT, secret: SECRET, jeton: JETON };

function lireCorps(requete: IncomingMessage): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    const morceaux: Buffer[] = [];
    requete.on("data", (m: Buffer) => morceaux.push(m));
    requete.on("end", () => resoudre(Buffer.concat(morceaux)));
    requete.on("error", rejeter);
  });
}

/** Les parties d'un corps multipart, par leur nom : assez pour juger un dépôt. */
function parties(corps: Buffer, typeDeContenu: string): Map<string, Buffer> {
  const frontiere = typeDeContenu.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.slice(1).find(Boolean);
  const rendu = new Map<string, Buffer>();
  if (!frontiere) return rendu;
  const separateur = Buffer.from(`--${frontiere}`);
  let debut = corps.indexOf(separateur);
  while (debut !== -1) {
    const suivant = corps.indexOf(separateur, debut + separateur.length);
    if (suivant === -1) break;
    const morceau = corps.subarray(debut + separateur.length + 2, suivant - 2);
    const finEntetes = morceau.indexOf("\r\n\r\n");
    const entetes = morceau.subarray(0, finEntetes).toString("utf8");
    const nom = entetes.match(/name="([^"]+)"/)?.[1];
    if (nom) rendu.set(nom, morceau.subarray(finEntetes + 4));
    debut = suivant;
  }
  return rendu;
}

export async function demarrerFaussePlateforme(mode: ModeFaussePlateforme = "accepte"): Promise<FaussePlateforme> {
  const etat = { mode, depots: [] as DepotRecu[] };
  const repondre = (res: import("node:http").ServerResponse, code: number, corps: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(corps));
  };

  const serveur: Server = createServer(async (req, res) => {
    const corps = await lireCorps(req);
    const url = new URL(req.url ?? "/", "http://fausse");
    if (etat.mode === "muette") return repondre(res, 503, { errorMessage: "Service indisponible" });

    if (req.method === "POST" && url.pathname === "/token") {
      const p = new URLSearchParams(corps.toString("utf8"));
      const bons = p.get("grant_type") === "client_credentials" && p.get("client_id") === IDENTIFIANT && p.get("client_secret") === SECRET;
      if (!bons || etat.mode === "revoque") return repondre(res, 401, { error: "invalid_client" });
      return repondre(res, 200, { access_token: JETON, token_type: "Bearer", expires_in: 3600 });
    }

    const autorise = req.headers.authorization === `Bearer ${JETON}` && etat.mode !== "revoque";
    if (!autorise) return repondre(res, 401, { errorMessage: "Jeton refusé" });

    if (req.method === "GET" && url.pathname === "/flow-service/v1/healthcheck") return repondre(res, 200, { status: "UP" });

    if (req.method === "POST" && url.pathname === "/flow-service/v1/flows") {
      const morceaux = parties(corps, String(req.headers["content-type"] ?? ""));
      const info = morceaux.get("flowInfo");
      const fichier = morceaux.get("file");
      if (!info || !fichier) return repondre(res, 400, { errorMessage: "flowInfo et file sont exigés" });
      const flowInfo = JSON.parse(info.toString("utf8")) as Record<string, unknown>;
      if (!flowInfo.name || flowInfo.flowSyntax !== "Factur-X") return repondre(res, 400, { errorMessage: "flowInfo incomplet" });
      if (fichier.subarray(0, 5).toString("latin1") !== "%PDF-") return repondre(res, 400, { errorMessage: "Le fichier n'est pas un PDF" });
      if (etat.mode === "rejette") {
        return repondre(res, 422, { details: [{ level: "Error", item: "BT-47", reasonCode: "REJ_SEMAN", reasonMessage: "Il manque le SIREN du client." }] });
      }
      const flowId = `flux-${etat.depots.length + 1}`;
      etat.depots.push({ flowId, flowInfo, fichier });
      return repondre(res, 202, { flowId, submittedAt: new Date().toISOString(), ...flowInfo });
    }

    const lecture = url.pathname.match(/^\/flow-service\/v1\/flows\/([^/]+)$/);
    if (req.method === "GET" && lecture) {
      const depot = etat.depots.find((d) => d.flowId === decodeURIComponent(lecture[1]));
      if (!depot) return repondre(res, 404, { errorMessage: "Flux inconnu" });
      const acknowledgement =
        etat.mode === "refuse"
          ? { status: "Error", details: [{ level: "Error", item: "BT-47", reasonCode: "REJ_SEMAN", reasonMessage: "Il manque le SIREN du client." }] }
          : { status: "Ok" };
      return repondre(res, 200, { flowId: depot.flowId, acknowledgement });
    }
    return repondre(res, 404, { errorMessage: "Chemin inconnu" });
  });

  await new Promise<void>((resoudre) => serveur.listen(0, "127.0.0.1", resoudre));
  const { port } = serveur.address() as AddressInfo;
  return {
    adresseFlux: `http://127.0.0.1:${port}/flow-service`,
    adresseJeton: `http://127.0.0.1:${port}/token`,
    get depots() {
      return etat.depots;
    },
    get mode() {
      return etat.mode;
    },
    set mode(m: ModeFaussePlateforme) {
      etat.mode = m;
    },
    fermer: () => new Promise<void>((resoudre) => serveur.close(() => resoudre())),
  };
}
