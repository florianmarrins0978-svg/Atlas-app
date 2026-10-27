import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { withEntreprise } from "@/server/db/with-entreprise";
import { photos, notesVocales, entreprises } from "@/server/db/schema";
import { lireObjet } from "@/server/storage";
import { typeDepuisCle } from "@/lib/type-de-fichier";
import type { Ctx } from "@/server/repositories/context";

// Équivalent local d'une URL signée : jamais de lien direct stocké, la clé est
// vérifiée à chaque requête contre l'entreprise du contexte avant lecture du
// fichier — remplacé par de vraies URLs signées à la connexion d'un bucket réel.
//
// ─────────────────────────────────────────────────────────────────────────────
// **LE TYPE SERVI NE VIENT PLUS DE LA BASE, et c'était une faille** (audit du
// 23 août 2026, constat M1). Cette route renvoyait `photos.mimeType`, écrit au
// dépôt tel que **le navigateur l'avait déclaré**. Annoncer `image/svg+xml`
// faisait donc servir un document SVG depuis notre propre domaine — et un SVG
// peut porter du script, qui s'exécute alors avec la session de l'artisan.
//
// La requête ci-dessous ne sert plus qu'à **autoriser** : elle répond « cette
// clé appartient-elle à cette entreprise ? ». Le type, lui, se déduit de
// l'extension, que le SERVEUR a posée (`src/lib/type-de-fichier.ts`).
//
// **`nosniff` ne suffisait pas**, et il faut le dire pour qu'on ne le croie pas
// une seconde fois : il interdit de DEVINER un type, pas d'en annoncer un.
/**
 * Cette clé de stockage appartient-elle à l'entreprise du contexte ?
 *
 * **Exportée, et distincte du `GET` ci-dessous, pour une seule raison : elle
 * ne dépend d'aucun en-tête de requête.** `GET`, lui, a besoin de
 * `x-atlas-pathname` (posé par le middleware) pour `exigerOuverture` — ce
 * qu'aucune suite base ne peut fournir hors d'une vraie requête HTTP. Cette
 * fonction-ci, en revanche, se rejoue directement sous `atlas_app`, dans une
 * suite base, sans navigateur ni middleware : c'est ce qui a manqué pendant
 * deux mois à la fuite du logo (ci-dessous), restée sans régression
 * permanente après sa correction du 29 août 2026 — seule une suite e2e
 * pouvait l'éprouver, et les suites e2e servent leur serveur sous un rôle qui
 * TRAVERSE la RLS (`CLAUDE.md` §5) : elles ne peuvent PAS prouver qu'une
 * protection qui ne tiendrait que par la RLS tient réellement. Campagne red
 * team du 27 octobre 2026 : vu passer à travers sous le rôle de ces suites,
 * exactement pour cette raison — ni `photos` ni `notes_vocales` n'avaient de
 * second rempart, alors que `entreprises`, lui, en a un depuis le 29 août.
 */
export async function autoriseLectureDuFichier(ctx: Ctx, storageKey: string): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // **`isNull(deletedAt)` — une photo supprimée ne se sert plus.** La
    // suppression est DOUCE : la ligne survit à l'écran qui annonce « retirée »,
    // et sa clé continuait donc d'autoriser la lecture jusqu'à la purge. Or
    // rien, dans ce dépôt, n'appelle la purge aujourd'hui (voir `TODO.md`) :
    // « jusqu'à la purge » voulait dire « pour toujours ».
    //
    // **`eq(photos.entrepriseId, ctx.entrepriseId)` — en défense en
    // profondeur, depuis le 27 octobre 2026.** La RLS suffit en production
    // (rôle `atlas_app`, sans `BYPASSRLS`, prouvé par la batterie base) ; elle
    // ne suffit plus dès que ce rôle change — exactement ce qui vient de
    // montrer la fuite du logo deux lignes plus bas, et qui s'applique de la
    // même façon à `photos` et `notes_vocales` : rien ne les en protégeait
    // spécifiquement jusqu'ici.
    const [photo] = await tx
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.storageKey, storageKey), eq(photos.entrepriseId, ctx.entrepriseId), isNull(photos.deletedAt)))
      .limit(1);
    if (photo) return true;
    // **Pas de filtre d'EFFACEMENT équivalent ici, et ce n'est pas un oubli :**
    // `notes_vocales` ne porte aucune suppression douce — son audio part par la
    // file `audios_a_purger`, et la ligne, elle, garde sa transcription. Le
    // typage l'a dit avant qu'on l'écrive. Le filtre d'ENTREPRISE, lui, est le
    // même que ci-dessus, pour la même raison.
    const [note] = await tx
      .select({ id: notesVocales.id })
      .from(notesVocales)
      .where(and(eq(notesVocales.storageKey, storageKey), eq(notesVocales.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (note) return true;
    // ═══════════════════════════════════════════════════════════════════════
    // **LE LOGO — ET LA FUITE ENTRE ENTREPRISES QUI VIVAIT ICI.**
    //
    // Constat de l'audit final, 29 août 2026, **mesuré en base et non déduit**.
    //
    // Le commentaire qui tenait cette place affirmait : « la ligne `entreprises`
    // est déjà bornée par l'isolation : une clef d'une autre entreprise ne
    // trouve rien ici, exactement comme une photo ». **C'était faux**, et c'est
    // cette phrase qui a empêché de voir le trou pendant des mois.
    //
    // `entreprises` **n'a aucune politique RLS** — ni `ENABLE`, ni `FORCE`, ni
    // la moindre politique ; aucune des 78 migrations n'en pose. Contrairement à
    // `photos` et `notes_vocales`, rien ne bornait donc cette lecture, et c'est
    // la seule des quatorze requêtes du dépôt sur cette table qui n'écrivait pas
    // son propre `where id = …`.
    //
    // Mesure, sous `atlas_app`, contexte posé sur l'entreprise A :
    //     SELECT nom FROM entreprises WHERE logo_storage_key = '<clé de B>'
    //     → « Entreprise B »
    // La route rendait alors `true` et servait les octets.
    //
    // **Le filtre explicite est donc la protection, pas un doublon de la RLS.**
    // Cloisonner `entreprises` reste souhaitable en défense en profondeur, mais
    // c'est une migration à part : les chemins publics par jeton lisent cette
    // table, et l'un d'eux (`lireRapportParJeton`) ne pose pas de contexte.
    // ═══════════════════════════════════════════════════════════════════════
    const [e] = await tx
      .select({ id: entreprises.id })
      .from(entreprises)
      .where(and(eq(entreprises.id, ctx.entrepriseId), eq(entreprises.logoStorageKey, storageKey)))
      .limit(1);
    return Boolean(e);
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const storageKey = key.join("/");

  const ctx = await getCurrentCtx();

  // Le rôle referme ce que la barre du bas ne montre plus : une adresse d'API
  // se tape, et une page retirée du sommaire répondait quand même.
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;

  const autorise = await autoriseLectureDuFichier(ctx, storageKey);

  if (!autorise) {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }

  try {
    const octets = await lireObjet(storageKey);
    return new NextResponse(new Uint8Array(octets), {
      headers: { "Content-Type": typeDepuisCle(storageKey), "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
