"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, surPlein, texteSituation } from "@/lib/design-tokens";
import BarreEnregistrer from "@/components/atlas/BarreEnregistrer";
import { initialesDe, nomAffiche } from "@/lib/identite-personne";
import { CIVILITES } from "@/lib/civilite";
import { ecrireIdentiteAction } from "./actions";

/**
 * « Mon compte » — `maquettes/atlas-reglages-moi.html`, écran 1.
 *
 * **L'e-mail se LIT, il ne se change pas — et ce n'est pas un oubli.** C'est
 * l'identifiant de connexion, et Atlas n'a AUCUN canal pour le confirmer : ni
 * e-mail sortant, ni SMS (tranché le 4 août 2026), ni parcours d'inscription,
 * ni réinitialisation par courriel. Une lettre de travers dans ce champ, et le
 * compte devient inaccessible — sans le moindre moyen de revenir en arrière.
 * Un champ dont la faute de frappe est irréparable ne s'ouvre pas tant qu'il
 * n'y a pas de quoi la rattraper. L'écran le DIT plutôt que de laisser croire à
 * une panne (`TODO.md` §0 octovicies).
 */
type Initial = { civilite: "mr" | "mme" | null; prenom: string; nom: string; email: string };

export default function CompteClient({ initial }: { initial: Initial }) {
  const [civilite, setCivilite] = useState<"mr" | "mme" | null>(initial.civilite);
  const [prenom, setPrenom] = useState(initial.prenom);
  const [nom, setNom] = useState(initial.nom);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  /** Ce qui n'est pas encore écrit — le bouton du bas DIT cet état (§99). */
  const [aEcrire, setAEcrire] = useState(false);

  function enregistrer() {
    demarrer(async () => {
      const r = await ecrireIdentiteAction({ civilite, prenom, nom });
      setRefus(r.ok ? null : r.raison);
      if (r.ok) setAEcrire(false);
    });
  }

  const identite = { civilite, prenom, nom };
  // Les initiales, à défaut d'un portrait : `users.image` existe et reste vide
  // — personne ne téléverse une photo depuis un chantier, et un rond vide se
  // lit comme un écran cassé.
  const initiales = initialesDe(identite, initial.email);
  const affiche = nomAffiche(identite);

  return (
    // `pb-40` : la barre d'enregistrement s'ajoute aux onglets.
    <div className="pb-40">
      {refus && (
        <p
          role="alert"
          className={`mx-[26px] mt-4 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}`, color: colors.alert }}
        >
          {refus}
        </p>
      )}

      <div className="mx-[26px] mt-[26px] flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full"
          style={{ backgroundColor: colors.card, color: colors.or, fontFamily: font.display, fontSize: 19 }}
        >
          {initiales}
        </span>
        {/* **Le nom seul, sans « Ce compte » dessous.** Sa demande du 26 août
            2026. Un écran qui s'appelle « Mon compte » n'a pas besoin de dire
            sous chaque ligne qu'on y est. */}
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.25 }}>
            {affiche === "" ? initial.email : affiche}
          </span>
        </span>
      </div>

      <section
        className="mx-[26px] mt-[30px] border-t pt-[18px] [&>*:last-child]:border-b-0"
        style={{ borderColor: colors.line }}
      >
        <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
          Qui vous êtes
        </p>

        {/* **LA CIVILITÉ SE CHOISIT, ELLE NE SE TAPE PAS.** Sa demande du
            8 septembre 2026, capture à l'appui : « l'identité comme sur la
            photo avec Mr. Madame nom prénom ». Deux cibles de 44 px plutôt
            qu'un champ libre — « Mr », « M. », « monsieur » partiraient
            ensuite sur des documents, et rien ne saurait les rapprocher.

            **On peut la retirer** en réappuyant : elle n'est obligatoire nulle
            part, et un choix qu'on ne peut pas défaire se regrette. */}
        <div className="border-b py-[13px]" style={{ borderColor: colors.line }}>
          <span className={`mb-2 block ${libelleCaps}`} style={{ color: colors.inkSoft }}>
            Civilité
          </span>
          <div className="flex gap-2.5">
            {(["mme", "mr"] as const).map((code) => {
              const choisie = civilite === code;
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={choisie}
                  onClick={() => {
                    setCivilite(choisie ? null : code);
                    setAEcrire(true);
                  }}
                  className="h-11 flex-1 rounded-full"
                  style={{
                    fontFamily: font.display,
                    fontSize: 16,
                    backgroundColor: choisie ? colors.plein : colors.card,
                    color: choisie ? surPlein : colors.ink,
                    border: `1px solid ${choisie ? colors.plein : colors.line}`,
                  }}
                >
                  {CIVILITES[code]}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block border-b py-[13px]" style={{ borderColor: colors.line }}>
          <span className={`mb-[5px] block ${libelleCaps}`} style={{ color: colors.inkSoft }}>
            Prénom
          </span>
          <input
            type="text"
            value={prenom}
            autoComplete="given-name"
            aria-label="Prénom"
            onChange={(e) => {
              setPrenom(e.target.value);
              setAEcrire(true);
            }}
            onBlur={enregistrer}
            className="block w-full border-0 bg-transparent p-0 outline-none"
            // 16 px au moins : en dessous, iOS agrandit la page à la mise au
            // point et il se retrouve avec un écran zoomé à rétablir à la main.
            style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.35, color: colors.ink }}
          />
        </label>

        {/* **« Nom » veut dire NOM DE FAMILLE depuis la migration 0077** — mais
            les comptes d'avant portent ici leur nom complet, et on ne les a pas
            découpés : « Jean-Pierre de La Fontaine » ne se coupe pas par un
            espace. L'écran ne dit rien de tout cela, et c'est voulu : celui qui
            veut séparer les deux le voit en regardant ses deux cases. */}
        <label className="block border-b py-[13px]" style={{ borderColor: colors.line }}>
          <span className={`mb-[5px] block ${libelleCaps}`} style={{ color: colors.inkSoft }}>
            Nom
          </span>
          <input
            type="text"
            value={nom}
            autoComplete="family-name"
            aria-label="Nom"
            onChange={(e) => {
              setNom(e.target.value);
              setAEcrire(true);
            }}
            onBlur={enregistrer}
            className="block w-full border-0 bg-transparent p-0 outline-none"
            style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.35, color: colors.ink }}
          />
        </label>

        <div className="border-b py-[13px]" style={{ borderColor: colors.line }}>
          <span className={`mb-[5px] block ${libelleCaps}`} style={{ color: colors.inkSoft }}>
            E-mail
          </span>
          <span
            className="block break-all"
            style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.35, color: colors.ink }}
          >
            {initial.email}
          </span>
          {/* **Six mots au lieu de quarante — sa demande du 26 août 2026.** Ce
              qui a été retiré, c'est le POURQUOI : rien ne permet de vérifier
              une nouvelle adresse, et une faute de frappe fermerait le compte.
              Cela reste vrai, et c'est sa place ici (`ARCHITECTURE.md`), pas à
              l'écran.

              **Mais la ligne ne disparaît pas**, contrairement à celle du nom :
              un champ qui ne s'ouvre pas quand on le touche se lit comme une
              panne, et il chercherait ce qu'il a mal fait. */}
          <span className={`mt-1.5 block ${texteSituation}`} style={{ color: colors.inkSoft }}>
            Sert aussi à vous connecter. Pas encore modifiable.
          </span>
        </div>
      </section>

      {/* **Le paragraphe du téléphone est parti — sa demande du 26 août 2026 :**
          *« supprime la phrase sous enregistrer »*. Il expliquait pourquoi il
          n'y a pas de champ téléphone (sa réponse « A » du 14 août), en quatre
          lignes, sous le bouton — donc à moitié caché par la barre.

          **La décision, elle, n'a pas bougé** : aucun champ téléphone ici, et
          `test-compte-connexion-e2e.ts` le refuse toujours. C'est l'explication
          qui part, pas la règle. */}

      <BarreEnregistrer aEcrire={aEcrire} enCours={enCours} onEnregistrer={enregistrer} />
    </div>
  );
}
