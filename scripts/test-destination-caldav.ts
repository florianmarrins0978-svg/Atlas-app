// Où Atlas a le droit d'aller frapper — et tout ce qu'il refuse.
//
// **CE QUE CETTE SUITE PROTÈGE.** Audit du 23 août 2026, constat E2 : l'adresse
// du calendrier d'écriture arrivait du navigateur, n'était vérifiée nulle part,
// et servait directement d'adresse à `fetch` — avec l'en-tête `Authorization`
// du compte iCloud de l'artisan dessus. Un propriétaire d'entreprise pouvait
// faire émettre au serveur des `PUT` vers le service de métadonnées de
// l'hébergeur, vers une administration interne, vers ce qu'il voulait.
//
// **TOUS les refus ci-dessous passaient sur l'ancien code** : il n'y avait
// aucune vérification à contourner.
//
// Éprouvée sans réseau — et c'est le but : ces adresses ne doivent jamais être
// composées, même pour un contrôle.

import assert from "node:assert/strict";
import {
  DOMAINE_ICLOUD,
  destinationAutorisee,
  hoteInterne,
  hoteSousDomaine,
} from "../src/lib/destination-caldav";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

function refuse(adresse: string, refusAttendu?: string) {
  const d = destinationAutorisee(adresse);
  assert.equal(d.ok, false, `ACCEPTÉE alors qu'elle devait être refusée : ${adresse}`);
  if (!d.ok && refusAttendu) assert.equal(d.refus, refusAttendu, `mauvais motif pour ${adresse}`);
}

function accepte(adresse: string) {
  const d = destinationAutorisee(adresse);
  assert.equal(d.ok, true, `REFUSÉE alors qu'elle est légitime : ${adresse}`);
}

console.log("=== Les destinations CalDAV : ce qu'Atlas joint, et ce qu'il refuse ===\n");

// ─── Le service de métadonnées : la cible classique d'une SSRF ──────────────

essai("169.254.169.254 — les métadonnées de l'hébergeur — est refusée", () => {
  refuse("https://169.254.169.254/latest/meta-data/", "adresse-interne");
  refuse("https://169.254.169.254/", "adresse-interne");
  // Écrite en v6 déguisée, c'est la même machine.
  refuse("https://[::ffff:169.254.169.254]/latest/meta-data/", "adresse-interne");
  refuse("https://[::ffff:a9fe:a9fe]/latest/meta-data/", "adresse-interne");
});

// ─── La machine elle-même ───────────────────────────────────────────────────

essai("localhost, 127.0.0.1 et ::1 sont refusés", () => {
  refuse("https://localhost/dav/", "adresse-interne");
  refuse("https://localhost.localdomain/dav/", "adresse-interne");
  refuse("https://quelque.chose.localhost/dav/", "adresse-interne");
  refuse("https://127.0.0.1/dav/", "adresse-interne");
  refuse("https://127.0.0.53/dav/", "adresse-interne");
  refuse("https://[::1]/dav/", "adresse-interne");
  refuse("https://[::]/dav/", "adresse-interne");
  refuse("https://0.0.0.0/dav/", "adresse-interne");
});

// ─── Les réseaux privés ─────────────────────────────────────────────────────

essai("les plages privées IPv4 sont refusées", () => {
  for (const ip of ["10.0.0.5", "10.255.255.254", "172.16.0.1", "172.31.255.254", "192.168.1.1", "192.0.0.1"]) {
    refuse(`https://${ip}/dav/`, "adresse-interne");
  }
});

essai("les plages IPv4 partagées, de mesure et de multidiffusion aussi", () => {
  for (const ip of ["100.64.0.1", "198.18.0.1", "198.19.255.254", "224.0.0.1", "239.255.255.250", "255.255.255.255"]) {
    refuse(`https://${ip}/dav/`, "adresse-interne");
  }
});

essai("les plages privées IPv6 sont refusées", () => {
  for (const ip of ["fd00::1", "fc00::1", "fe80::1", "fe80::a00:27ff:fe4e:66a1", "ff02::1"]) {
    refuse(`https://[${ip}]/dav/`, "adresse-interne");
  }
});

// ─── Le changement de domaine ───────────────────────────────────────────────

essai("un autre domaine est refusé, même bien formé", () => {
  refuse("https://mechant.example/dav/", "hote-refuse");
  refuse("https://caldav.google.com/dav/", "hote-refuse");
  // Le piège du suffixe : « icloud.com.mechant.example » CONTIENT « icloud.com ».
  refuse("https://icloud.com.mechant.example/dav/", "hote-refuse");
  refuse("https://faux-icloud.com/dav/", "hote-refuse");
  refuse("https://icloud.com.evil/dav/", "hote-refuse");
});

// **Le cas qui fait tomber une comparaison de texte**, et c'est pour lui que
// l'on analyse l'URL au lieu de la comparer : celle-ci COMMENCE par
// « https://caldav.icloud.com » et mène chez `mechant.example`.
essai("une adresse fabriquée pour tromper une comparaison naïve est refusée", () => {
  refuse("https://caldav.icloud.com@mechant.example/dav/", "hote-refuse");
  refuse("https://caldav.icloud.com:mot@mechant.example/dav/", "hote-refuse");
  refuse("https://mechant.example/https://caldav.icloud.com/dav/", "hote-refuse");
  refuse("https://mechant.example/#caldav.icloud.com", "hote-refuse");
  refuse("https://mechant.example/?x=caldav.icloud.com", "hote-refuse");
  // Et la preuve que la naïveté aurait mordu :
  assert.ok(
    "https://caldav.icloud.com@mechant.example/dav/".startsWith("https://caldav.icloud.com"),
    "ce cas n'éprouve plus rien"
  );
});

// ─── Le schéma ──────────────────────────────────────────────────────────────

essai("http en clair est refusé — le mot de passe du compte est dans l'en-tête", () => {
  refuse("http://caldav.icloud.com/dav/", "schema");
  refuse("http://p42-caldav.icloud.com/1234/calendars/work/", "schema");
});

essai("les schémas exotiques sont refusés", () => {
  refuse("file:///etc/passwd", "schema");
  refuse("gopher://caldav.icloud.com/", "schema");
  refuse("ftp://caldav.icloud.com/", "schema");
});

essai("une adresse illisible est refusée, jamais devinée", () => {
  refuse("pas une adresse", "illisible");
  refuse("", "illisible");
  refuse("/dav/relatif", "illisible");
});

// ─── Ce qui doit CONTINUER de passer ────────────────────────────────────────
//
// **La moitié qui protège la fonctionnalité.** iCloud répond `301` depuis
// `caldav.icloud.com` vers le serveur qui héberge réellement le compte —
// `p42-caldav.icloud.com`. Une règle « aucune redirection vers un autre hôte »
// aurait cassé tout raccordement Apple. Ce qu'on refuse, c'est de SORTIR du
// domaine, pas d'y circuler.
essai("le renvoi normal d'iCloud reste accepté", () => {
  accepte("https://caldav.icloud.com/.well-known/caldav");
  accepte("https://p42-caldav.icloud.com/1234567890/calendars/");
  accepte("https://p117-caldav.icloud.com/1234567890/calendars/work/");
  accepte("https://icloud.com/dav/");
  // Le point final d'un nom absolu désigne le même hôte.
  accepte("https://caldav.icloud.com./.well-known/caldav");
});

essai("un port ou une casse inhabituels ne changent pas le verdict", () => {
  accepte("https://CalDAV.iCloud.COM/.well-known/caldav");
  accepte("https://p42-caldav.icloud.com:443/1234/calendars/");
});

// ─── Les briques, prises séparément ─────────────────────────────────────────

essai("hoteSousDomaine ne se laisse pas avoir par un suffixe", () => {
  assert.equal(hoteSousDomaine("icloud.com", [DOMAINE_ICLOUD]), true);
  assert.equal(hoteSousDomaine("p42-caldav.icloud.com", [DOMAINE_ICLOUD]), true);
  assert.equal(hoteSousDomaine("icloud.com.mechant.example", [DOMAINE_ICLOUD]), false);
  assert.equal(hoteSousDomaine("mechanticloud.com", [DOMAINE_ICLOUD]), false);
});

essai("hoteInterne distingue une adresse publique d'une adresse interne", () => {
  assert.equal(hoteInterne("8.8.8.8"), false);
  assert.equal(hoteInterne("17.253.144.10"), false); // Apple, publique
  assert.equal(hoteInterne("192.168.0.1"), true);
  assert.equal(hoteInterne("2001:4860:4860::8888"), false); // Google, publique
  assert.equal(hoteInterne("caldav.icloud.com"), false);
});

// ─── La règle est-elle vraiment BRANCHÉE sur les appels réseau ? ────────────
//
// **Une règle juste qu'on n'appelle pas ne protège rien.** Ces cas-ci ne
// jugent plus la règle : ils vérifient qu'elle se trouve bien sur le chemin,
// avant l'ouverture de la connexion. `fetch` est remplacé par un piège : s'il
// est appelé, le contrôle rougit.

const vraiFetch = globalThis.fetch;
let fetchAppele = 0;
globalThis.fetch = (async () => {
  fetchAppele++;
  throw new Error("PIÈGE : une connexion a été ouverte vers une adresse refusée");
}) as typeof fetch;

const IDENT = { compte: "artisan@icloud.com", motDePasse: "abcd-efgh-ijkl-mnop" };

async function essaiAsync(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function brancheeSurLeReseau() {
  const { poserEvenement, retirerEvenement, DestinationRefusee } = await import("../src/server/agenda/apple");

  await essaiAsync("poserEvenement REFUSE une adresse interne, sans ouvrir de connexion", async () => {
    fetchAppele = 0;
    await assert.rejects(
      () => poserEvenement(IDENT, "https://169.254.169.254/latest/meta-data", "uid-1", "BEGIN:VCALENDAR"),
      (e: Error) => e instanceof DestinationRefusee,
      "l'appel n'a pas été refusé"
    );
    assert.equal(fetchAppele, 0, "une connexion a été ouverte malgré le refus");
  });

  await essaiAsync("poserEvenement REFUSE un autre domaine", async () => {
    fetchAppele = 0;
    await assert.rejects(
      () => poserEvenement(IDENT, "https://mechant.example/dav", "uid-2", "BEGIN:VCALENDAR"),
      (e: Error) => e instanceof DestinationRefusee
    );
    assert.equal(fetchAppele, 0);
  });

  await essaiAsync("poserEvenement REFUSE le http en clair", async () => {
    fetchAppele = 0;
    await assert.rejects(
      () => poserEvenement(IDENT, "http://caldav.icloud.com/dav", "uid-3", "BEGIN:VCALENDAR"),
      (e: Error) => e instanceof DestinationRefusee
    );
    assert.equal(fetchAppele, 0);
  });

  await essaiAsync("retirerEvenement est gardé de la même façon", async () => {
    fetchAppele = 0;
    await assert.rejects(
      () => retirerEvenement(IDENT, "https://[::1]/dav", "uid-4"),
      (e: Error) => e instanceof DestinationRefusee
    );
    assert.equal(fetchAppele, 0);
  });

  // **Et le refus doit désigner le bon coupable.** `RefusApple` dit « Apple a
  // répondu non » ; ici, on n'a même pas composé le numéro. Les confondre
  // enverrait l'artisan refaire son mot de passe pour rien (`AGENTS.md`).
  await essaiAsync("le refus dit que c'est ATLAS qui refuse, pas Apple", async () => {
    await assert.rejects(
      () => poserEvenement(IDENT, "https://10.0.0.5/dav", "uid-5", "BEGIN:VCALENDAR"),
      (e: Error) => /Atlas refuse de joindre/.test(e.message) && !/mot de passe pour les apps/.test(e.message)
    );
  });

  // Une adresse légitime doit, elle, ATTEINDRE le réseau — sinon ce lot aurait
  // simplement débranché l'agenda Apple, et personne ne s'en apercevrait avant
  // le premier chantier planifié.
  await essaiAsync("une adresse iCloud légitime va bien jusqu'à la connexion", async () => {
    fetchAppele = 0;
    await assert.rejects(
      () => poserEvenement(IDENT, "https://p42-caldav.icloud.com/1234/calendars/work", "uid-6", "BEGIN:VCALENDAR"),
      (e: Error) => /PIÈGE/.test(e.message),
      "l'appel légitime a été bloqué avant le réseau"
    );
    assert.equal(fetchAppele, 1, "l'appel légitime n'a jamais atteint la connexion");
  });

  // ─── La redirection : le saut qu'on ne contrôle pas ───────────────────────
  //
  // C'est le SERVEUR distant qui écrit `Location:`. Sur l'ancien code, il
  // suffisait donc qu'iCloud — ou n'importe qui se faisant passer pour lui —
  // renvoie vers une adresse interne pour que l'en-tête `Authorization` du
  // compte de l'artisan y parte.
  async function avecRenvoi(vers: string, fn: () => Promise<unknown>) {
    let sauts = 0;
    globalThis.fetch = (async () => {
      sauts++;
      return new Response(null, { status: 301, headers: { location: vers } });
    }) as typeof fetch;
    let erreur: Error | null = null;
    try {
      await fn();
    } catch (e) {
      erreur = e as Error;
    }
    return { sauts, erreur };
  }

  const LEGITIME = "https://caldav.icloud.com/1234/calendars/work";

  await essaiAsync("un renvoi HORS du domaine est refusé, au saut suivant", async () => {
    const r = await avecRenvoi("https://mechant.example/dav", () =>
      poserEvenement(IDENT, LEGITIME, "uid-7", "BEGIN:VCALENDAR")
    );
    assert.ok(r.erreur instanceof DestinationRefusee, `refus attendu, obtenu : ${r.erreur?.message}`);
    assert.equal(r.sauts, 1, "le second saut a été composé malgré le refus");
  });

  await essaiAsync("un renvoi vers une adresse interne est refusé", async () => {
    for (const cible of ["http://169.254.169.254/latest/meta-data", "https://127.0.0.1/dav", "https://[fd00::1]/dav"]) {
      const r = await avecRenvoi(cible, () => poserEvenement(IDENT, LEGITIME, "uid-8", "BEGIN:VCALENDAR"));
      assert.ok(r.erreur instanceof DestinationRefusee, `« ${cible} » n'a pas été refusée`);
      assert.equal(r.sauts, 1, `« ${cible} » a été composée`);
    }
  });

  // **Et le renvoi normal d'iCloud doit continuer de fonctionner** — c'est le
  // 301 de `caldav.icloud.com` vers `p42-caldav.icloud.com`, sans lequel aucun
  // compte Apple ne se relie. Une règle « aucune redirection vers un autre
  // hôte » aurait cassé la fonctionnalité en croyant la protéger.
  await essaiAsync("le renvoi normal d'iCloud est SUIVI", async () => {
    const r = await avecRenvoi("https://p42-caldav.icloud.com/1234/calendars/work", () =>
      poserEvenement(IDENT, LEGITIME, "uid-9", "BEGIN:VCALENDAR")
    );
    assert.ok(!(r.erreur instanceof DestinationRefusee), "le renvoi légitime d'iCloud a été refusé");
    assert.ok(r.sauts >= 2, `le renvoi n'a pas été suivi (${r.sauts} saut)`);
  });

  globalThis.fetch = vraiFetch;
  console.log("");
  console.log(`Les destinations CalDAV — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

console.log("");
console.log("--- et la règle est-elle branchée sur les appels réseau ? ---");
void brancheeSurLeReseau();
