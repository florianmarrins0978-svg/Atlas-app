"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { etatConfirmation, etatNouveau, verifierNouveauMotDePasse } from "@/lib/mot-de-passe";
import { changerMotDePasseAction, deconnecterPartoutAction } from "./actions";
import SectionFaceId from "./SectionFaceId";
import type { CleAppareil } from "@/lib/cle-appareil";

/**
 * « Connexion » — `maquettes/atlas-reglages-moi.html`, écran 3.
 *
 * **Ses deux demandes du 14 août 2026, mot pour mot :** *« il faut pouvoir
 * confirmer son mdp 2× avant de le changer et met le petit œil à côté pour
 * afficher ou non le mdp »*. Ma planche proposait l'œil À LA PLACE de la
 * seconde saisie ; il veut les deux, et il a raison — l'œil se touche après
 * coup, la confirmation attrape la faute au moment où elle se fait.
 *
 * **L'œil est sur les TROIS champs.** Une confirmation qu'on ne peut pas relire
 * ne confirme rien : elle se remplirait à l'aveugle, exactement comme la
 * première.
 *
 * **Les règles viennent de `src/lib/mot-de-passe.ts`, et le serveur emploie les
 * mêmes.** Deux rédactions divergeraient, et l'écart se paierait dans le
 * mauvais sens : un bouton allumé sur une saisie que le serveur refuse
 * (`CLAUDE.md` §3).
 */
export default function ConnexionClient({ cles }: { cles: CleAppareil[] }) {
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [refus, setRefus] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [partoutDemande, setPartoutDemande] = useState(false);

  const bloquant = verifierNouveauMotDePasse(nouveau, confirmation);
  const pret = actuel !== "" && bloquant === null && !enCours;
  const etat = etatConfirmation(nouveau, confirmation);
  const court = etatNouveau(nouveau);

  function changer() {
    demarrer(async () => {
      const r = await changerMotDePasseAction(actuel, nouveau, confirmation);
      if (r.ok) {
        setRefus(null);
        setFait("Votre mot de passe est changé.");
        // **Les trois champs se vident.** Les laisser remplis laisserait le
        // mot de passe en clair dans un écran ouvert sur une table de chantier,
        // et donnerait à croire qu'il reste quelque chose à faire.
        setActuel("");
        setNouveau("");
        setConfirmation("");
      } else {
        setFait(null);
        setRefus(r.raison);
      }
    });
  }

  function partout() {
    demarrer(async () => {
      const r = await deconnecterPartoutAction();
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      // **On s'en va vers la route qui EFFACE LES COOKIES.** Rester ici
      // laisserait une page dont chaque geste serait désormais refusé — l'écran
      // paraîtrait figé, et c'est le piège du 10 août 2026 : un cookie mort que
      // rien n'efface, et une soirée perdue.
      window.location.href = "/api/session-perimee";
    });
  }

  return (
    // **PLUS AUCUNE RÉSERVE ICI, et c'est 96 px repris — sa demande du 31 août
    // 2026 : « je veux qu'elle tienne sur une seule page ».** `pb-24` comptait
    // la barre du bas UNE SECONDE FOIS : `main.atlas-contenu`
    // (`src/app/layout.tsx`) la réserve déjà pour tous les écrans. C'est le
    // même défaut que celui corrigé sur l'export de chantier — un vide qui ne
    // porte rien et qui pousse la dernière rubrique hors de l'écran.
    <div>
      {refus && (
        <p
          role="alert"
          className={`mx-[26px] mt-4 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}`, color: colors.alert }}
        >
          {refus}
        </p>
      )}
      {fait && (
        <p
          role="status"
          className={`mx-[26px] mt-4 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.or}`, color: colors.ink }}
        >
          {fait}
        </p>
      )}

      <section
        className="mx-[26px] mt-[10px] [&>*:last-child]:border-b-0"
        style={{ borderColor: colors.line }}
      >
        <p className={`mb-1.5 ${libelleCaps}`} style={{ color: colors.muted }}>
          Changer de mot de passe
        </p>

        <ChampSecret
          etiquette="Mot de passe actuel"
          valeur={actuel}
          onChange={setActuel}
          autoComplete="current-password"
        />
        <ChampSecret
          etiquette="Nouveau mot de passe"
          valeur={nouveau}
          onChange={setNouveau}
          autoComplete="new-password"
          // **La longueur ne s'annonce plus au repos — 31 août 2026.** Elle
          // vivait ici en gris, en permanence, et il les a toutes fait
          // retirer. Elle parle désormais quand elle mord, et seulement là :
          // sans elle, un bouton éteint sur huit caractères n'aurait plus
          // aucune explication à l'écran.
          sous={court?.message ?? null}
          sousTeinte={court ? colors.alert : undefined}
        />
        <ChampSecret
          etiquette="Confirmer le nouveau mot de passe"
          valeur={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
          // La ligne ne parle QU'UNE FOIS qu'il a commencé à retaper : annoncer
          // « les deux diffèrent » sur un champ vide est une alarme qui hurle à
          // vide, et c'est ainsi qu'on apprend à ne plus les lire.
          sous={etat?.message ?? null}
          sousTeinte={etat ? (etat.identiques ? colors.or : colors.alert) : undefined}
        />
      </section>

      {/* **LE BOUTON SOUS SES PROPRES CHAMPS — sa demande du 26 août 2026 :**
          *« le bouton changer mon mot de passe doit se trouver au-dessus de
          ouvrir avec Face ID »*.

          Il était collé en bas de l'écran, sur une barre fixe. Deux rubriques
          l'en séparaient — Face ID, puis « Ailleurs » —, et l'on remplissait
          trois champs pour aller chercher, tout en bas, un bouton qui parlait
          d'eux. Pire : rien ne disait qu'il leur appartenait, et il restait là
          pendant qu'on réglait Face ID, comme si c'était le bouton de l'écran
          entier.

          Sous ses champs, il ne peut plus se lire autrement. */}
      <div className="mx-[26px] mt-[10px]">
        <button
          type="button"
          onClick={changer}
          disabled={!pret}
          className="block w-full rounded-full py-[13px] text-center text-[16px]"
          style={{
            backgroundColor: pret ? colors.rust : colors.card,
            color: pret ? colors.cream : colors.muted,
            boxShadow: pret ? "none" : `inset 0 0 0 1px ${colors.line}`,
          }}
        >
          {enCours ? "En cours…" : "Changer mon mot de passe"}
        </button>
      </div>

      {/* **Face ID vient APRÈS le mot de passe, et ce n'est pas un hasard de
          mise en page.** Sa règle du 23 août : on crée son compte au mot de
          passe, puis on décide. L'ordre de l'écran dit la même chose que la
          règle — le mot de passe d'abord, le raccourci ensuite. */}
      <SectionFaceId clesInitiales={cles} />

      <section
        className="mx-[26px] mt-[12px] border-t pt-[10px]"
        style={{ borderColor: colors.line }}
      >
        <p className={`mb-1.5 ${libelleCaps}`} style={{ color: colors.muted }}>
          Ailleurs
        </p>

        {/* **Deux appuis, et le second n'est pas une politesse.** Ce geste
            déconnecte l'appareil qui appuie : posé en un seul toucher au milieu
            d'un écran de réglages, il se déclenche par mégarde et le patron se
            retrouve devant l'écran de connexion sans comprendre pourquoi. */}
        {!partoutDemande ? (
          <button
            type="button"
            onClick={() => setPartoutDemande(true)}
            className="flex w-full items-center gap-3.5 py-[10px] text-left"
            style={{ minHeight: 44 }}
          >
            <span className="min-w-0 flex-1">
              <span className="block" style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.25 }}>
                Me déconnecter partout
              </span>
            </span>
            <span
              aria-hidden="true"
              className="h-2 w-2 flex-none rotate-45"
              style={{ borderRight: `1.5px solid ${colors.line}`, borderTop: `1.5px solid ${colors.line}` }}
            />
          </button>
        ) : (
          <div className="py-[13px]">
            <p className={texteSituation} style={{ color: colors.ink }}>
              Vous devrez vous reconnecter sur tous vos appareils, celui-ci compris.
            </p>
            {/* **CE QUE CE BOUTON NE FAIT PAS — et il faut le dire ICI.**

                Constaté le 25 août 2026, en éprouvant la coupure : un appareil
                déjà enregistré pour Face ID **rouvre aussitôt une session**.
                `deconnecterPartout` ne touche pas `cles_appareil`, et
                `ouvrirAvecCle` ne consulte jamais la coupure.

                L'écran ne le disait pas. Quelqu'un qui vient de perdre son
                téléphone appuyait ici en croyant l'avoir mis dehors — et se
                trompait, au pire moment. Ce n'est pas une nuance, c'est la
                différence entre « fermé » et « ouvert ».

                Le comportement, lui, ne change pas dans ce lot : retirer les
                appareils d'office obligerait à tous les réenregistrer après une
                simple déconnexion. On dit la vérité, et on montre le geste. */}
            {cles.length > 0 && (
              <p className={`mt-2 ${texteSituation}`} style={{ color: colors.muted }}>
                Vos appareils enregistrés pourront rouvrir Atlas avec Face ID. Si vous avez
                perdu l&apos;un d&apos;eux, retirez-le d&apos;abord dans la liste ci-dessus.
              </p>
            )}
            <div className="mt-3 flex gap-2.5">
              <button
                type="button"
                onClick={partout}
                disabled={enCours}
                className="atlas-plein flex-1 rounded-full py-[13px] text-center text-[15px]"
                style={{ backgroundColor: colors.rust, color: colors.cream }}
              >
                {enCours ? "En cours…" : "Me déconnecter partout"}
              </button>
              <button
                type="button"
                onClick={() => setPartoutDemande(false)}
                className="rounded-full px-5 py-[13px] text-center text-[15px]"
                style={{ backgroundColor: colors.card, color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Un mot de passe, avec son œil.
 *
 * **L'œil est gris, pas vert pin.** Le jeton dit que le pin porte ce qu'on
 * FAIT, mais un pictogramme plein de 22 px au bord d'un champ se lit comme un
 * bouton d'envoi — et le seul plein de l'écran doit rester « Changer mon mot de
 * passe ». Il passe au bronze une fois ouvert : c'est alors un état, et un état
 * se LIT.
 */
function ChampSecret({
  etiquette,
  valeur,
  onChange,
  autoComplete,
  sous,
  sousTeinte,
}: {
  etiquette: string;
  valeur: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  sous?: string | null;
  sousTeinte?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="border-b py-[8px]" style={{ borderColor: colors.line }}>
      <span className={`mb-[3px] block ${libelleCaps}`} style={{ color: colors.muted }}>
        {etiquette}
      </span>
      <div className="flex items-center gap-3">
        <input
          type={visible ? "text" : "password"}
          value={valeur}
          autoComplete={autoComplete}
          aria-label={etiquette}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
          // 16 px au moins : en dessous, iOS agrandit la page à la mise au point.
          style={{ fontSize: 17, lineHeight: 1.35, color: colors.ink, letterSpacing: visible ? "0.01em" : "0.18em" }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Le libellé DIT ce que l'appui va faire, pas ce qu'on voit : « Voir »
          // sur un mot de passe déjà visible envoie appuyer pour rien.
          aria-label={visible ? `Masquer ${etiquette.toLowerCase()}` : `Afficher ${etiquette.toLowerCase()}`}
          aria-pressed={visible}
          // **44 px de cible, mais 24 px de hauteur DANS la rangée.** Une
          // cible plus petite se rate une fois sur trois avec des gants — elle
          // ne bouge donc pas. Ce sont les marges négatives qui changent :
          // sans elles, l'œil imposait sa taille aux trois rangées et leur
          // ajoutait 20 px chacune, soit 60 px sur un écran qui doit tenir
          // d'un seul tenant (31 août 2026). `-mr-[11px]` déborde à droite
          // sans décaler le filet.
          className="-my-[10px] -mr-[11px] flex h-11 w-11 flex-none items-center justify-center"
          style={{ color: visible ? colors.or : colors.muted }}
        >
          <Oeil barre={visible} />
        </button>
      </div>
      {sous && (
        <span className={`mt-1 block ${texteSituation}`} style={{ color: sousTeinte ?? colors.muted }}>
          {sous}
        </span>
      )}
    </div>
  );
}

/** Le même dessin que sur la planche — 21 px, filaire, épaisseur 1,4. */
function Oeil({ barre }: { barre: boolean }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.4 12S6 5.8 12 5.8 21.6 12 21.6 12 18 18.2 12 18.2 2.4 12 2.4 12Z" />
      <circle cx="12" cy="12" r="3.1" />
      {barre && <path d="M4 20 20 4" />}
    </svg>
  );
}
