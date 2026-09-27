import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { withEntreprise } from "@/server/db/with-entreprise";
import { photos, notesVocales, entreprises } from "@/server/db/schema";
import { lireObjet } from "@/server/storage";
import { typeDepuisCle } from "@/lib/type-de-fichier";

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
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const storageKey = key.join("/");

  const ctx = await getCurrentCtx();


  // Le rôle referme ce que la barre du bas ne montre plus : une adresse d'API

  // se tape, et une page retirée du sommaire répondait quand même.

  const refus = await exigerOuverture(ctx);

  if (refus) return refus;
  const autorise = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // **`isNull(deletedAt)` — une photo supprimée ne se sert plus.** La
    // suppression est DOUCE : la ligne survit à l'écran qui annonce « retirée »,
    // et sa clé continuait donc d'autoriser la lecture jusqu'à la purge. Or
    // rien, dans ce dépôt, n'appelle la purge aujourd'hui (voir `TODO.md`) :
    // « jusqu'à la purge » voulait dire « pour toujours ».
    const [photo] = await tx
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.storageKey, storageKey), isNull(photos.deletedAt)))
      .limit(1);
    if (photo) return true;
    // **Pas de filtre équivalent ici, et ce n'est pas un oubli :**
    // `notes_vocales` ne porte aucune suppression douce — son audio part par la
    // file `audios_a_purger`, et la ligne, elle, garde sa transcription. Le
    // typage l'a dit avant qu'on l'écrive.
    const [note] = await tx
      .select({ id: notesVocales.id })
      .from(notesVocales)
      .where(eq(notesVocales.storageKey, storageKey))
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
