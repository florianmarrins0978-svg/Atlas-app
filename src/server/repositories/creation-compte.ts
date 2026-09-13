import { hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { abonnements, entreprises, membresEntreprise, users } from "@/server/db/schema";
import { FORMULE_DE_LESSAI, finDeLEssai } from "@/lib/abonnements";
import { adresseNormalisee } from "@/lib/donner-un-acces";
import { formeADuCapital } from "@/lib/formes-juridiques";
import { capitalEnBase } from "@/lib/mentions-legales";
import { messageRefus, verifierNouveauMotDePasse } from "@/lib/mot-de-passe";
import { logger } from "@/server/logger";

/**
 * CRÉER SON COMPTE ET SON ENTREPRISE — le geste de la porte.
 *
 * **Sa décision du 8 septembre 2026** : la porte en plein air, et « Créer un
 * compte » qui pose seize questions une à une. Ce fichier écrit ce qu'elles ont
 * récolté.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI EST CRÉÉ, ET C'EST LE POINT 5 DE LA PLANCHE** : un PATRON et SON
 * entreprise. Un salarié, lui, ne passe jamais par ici — il reçoit son accès de
 * son patron dans les réglages (`donnerUnAcces`). C'est ce qui fait que ce
 * chemin peut créer une entreprise sans qu'aucune ne préexiste.
 *
 * **POURQUOI PAS `creerEntreprise`, QUI EXISTE DÉJÀ.** Elle crée bien
 * l'entreprise, l'adhésion et le compteur — mais elle insère l'utilisateur
 * SANS mot de passe (elle sert au jeu de démonstration et aux migrations de
 * données). Un compte sans condensat ne peut pas se connecter, et
 * `changer_mot_de_passe` réclame l'ancien : il n'y en a pas. On insère donc
 * l'utilisateur ici, avec son condensat, exactement comme `donnerUnAcces` le
 * fait pour un salarié — même chemin, même coût, une seule façon de créer un
 * compte dans ce dépôt.
 *
 * **LA TRANSACTION EST LE POINT DÉLICAT.** Un compte créé sans entreprise
 * laisserait quelqu'un dedans sans rien à ouvrir, et il ne pourrait ni
 * recommencer (son adresse serait prise) ni entrer. Tout est donc dans une
 * seule transaction : ou les trois lignes existent, ou aucune.
 */

export type SaisieCompte = {
  civilite: "mr" | "mme";
  prenom: string;
  nom: string;
  email: string;
  motDePasse: string;
  entreprise: string;
  forme: string;
  siret?: string;
  adresse?: string;
  capital?: string;
  rcs?: string;
  telephone?: string;
  emailPro?: string;
  tva: "assujettie" | "franchise";
  numeroTva?: string;
  iban?: string;
  titulaire?: string;
  moyens?: string;
};

export type ResultatCreation =
  | { ok: true; utilisateurId: string; entrepriseId: string }
  | { ok: false; refus: string };

const vide = (v: string | undefined) => !v || !v.trim();
const propre = (v: string | undefined) => (vide(v) ? undefined : v!.trim());

export async function creerSonCompte(saisie: SaisieCompte): Promise<ResultatCreation> {
  const email = adresseNormalisee(saisie.email);

  const [existant] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existant) {
    // **On le dit, et on ne fait pas semblant.** Cacher qu'une adresse est
    // prise sur un écran de CRÉATION n'apprend rien à personne : celui qui
    // essaie sait déjà s'il a un compte, et celui qui ne l'a pas se retrouve
    // devant un échec sans explication.
    return { ok: false, refus: "Cette adresse a déjà un compte. Connectez-vous plutôt." };
  }

  // **La MÊME fonction que l'écran**, et c'est ce qui empêche l'écart
  // habituel : un bouton qui s'allume sur une saisie que le serveur refuse.
  const refusMdp = verifierNouveauMotDePasse(saisie.motDePasse, saisie.motDePasse);
  if (refusMdp) return { ok: false, refus: messageRefus(refusMdp) };
  if (vide(saisie.entreprise)) return { ok: false, refus: "Le nom de l’entreprise est nécessaire." };

  // Coût 10 : celui d'`authorize`, du changement de mot de passe, de
  // `donnerUnAcces` et du jeu de démonstration. En changer ici rendrait ce
  // chemin plus lent ou plus faible que les autres, sans que rien ne le dise.
  const passwordHash = await hash(saisie.motDePasse, 10);

  // **Le capital et le RCS ne s'écrivent que si la forme en a un.** Sans ce
  // filtre, une micro-entreprise pourrait porter un capital saisi avant de
  // changer de forme — et il s'imprimerait sur ses devis.
  const aDuCapital = formeADuCapital(saisie.forme);

  // **`undefined` veut dire « on n'a pas compris »** (`capitalEnBase`). À la
  // création il n'y a rien à préserver : le champ reste vide, et l'écran de fin
  // le nomme parmi ce qui reste à remplir. L'écran refuse déjà une saisie
  // illisible — ceci est la ceinture.
  const capital = aDuCapital ? capitalEnBase(saisie.capital) ?? null : null;

  return db.transaction(async (tx) => {
    const [entreprise] = await tx
      .insert(entreprises)
      .values({
        nom: saisie.entreprise.trim(),
        siret: propre(saisie.siret),
        adresse: propre(saisie.adresse),
        telephone: propre(saisie.telephone),
        email: propre(saisie.emailPro),
        iban: propre(saisie.iban),
        formeJuridique: propre(saisie.forme),
        capitalSocial: capital,
        villeRcs: aDuCapital ? propre(saisie.rcs) : null,
        regimeTva: saisie.tva,
        numeroTva: saisie.tva === "assujettie" ? propre(saisie.numeroTva) : null,
        titulaireCompte: propre(saisie.titulaire),
        moyensPaiement: propre(saisie.moyens),
      })
      .returning({ id: entreprises.id });

    const [compte] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        civilite: saisie.civilite,
        prenom: saisie.prenom.trim(),
        nom: saisie.nom.trim(),
      })
      .returning({ id: users.id });

    // Contexte RLS fixé dès que l'entreprise existe : `membres_entreprise`
    // porte `FORCE ROW LEVEL SECURITY`, et une écriture sans contexte n'y
    // passerait pas — silencieusement.
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${entreprise.id}, true)`);

    await tx.insert(membresEntreprise).values({
      entrepriseId: entreprise.id,
      utilisateurId: compte.id,
      role: "proprietaire",
    });

    // **L'essai commence ICI, et seulement ici** — sa décision du 10 septembre
    // 2026 : « essai gratuit 15 jours ». Un compte créé par la porte est le
    // seul qui en reçoive un ; les entreprises déjà en place n'ont pas de
    // ligne d'abonnement, et l'on ne leur en invente pas. Aucune carte n'est
    // demandée : Stripe ne connaît pas cette ligne, c'est Atlas qui compte.
    await tx.insert(abonnements).values({
      entrepriseId: entreprise.id,
      formule: FORMULE_DE_LESSAI,
      periodicite: "mensuelle",
      statut: "essai",
      periodeFin: finDeLEssai(new Date()),
    });

    logger.info("Compte créé depuis la porte", {
      entrepriseId: entreprise.id,
      forme: saisie.forme,
      regimeTva: saisie.tva,
    });

    return { ok: true, utilisateurId: compte.id, entrepriseId: entreprise.id };
  });
}
