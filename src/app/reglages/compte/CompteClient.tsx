"use client";

import { useState, useTransition } from "react";
import { colors, font, surPlein } from "@/lib/design-tokens";
import BarreEnregistrer from "@/components/atlas/BarreEnregistrer";
import { initialesDe, nomAffiche } from "@/lib/identite-personne";
import { CIVILITES } from "@/lib/civilite";
import FichePhoto from "@/components/atlas/FichePhoto";
import TeteRonde from "@/components/atlas/TeteRonde";
import Paquet from "@/components/atlas/reglages/Paquet";
import LigneReglage, { styleValeurReglage } from "@/components/atlas/reglages/LigneReglage";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import { ecrireIdentiteAction, poserMaPhotoAction, retirerMaPhotoAction } from "./actions";

/**
 * « Mon compte » — `maquettes/atlas-reglages-moi.html`, écran 1, puis sa
 * planche soignée du 26 octobre 2026 (`appli/soignee/reglages-compte.html`,
 * vue Proposé) : le rond et le nom dans une plage, les quatre lignes dans une
 * autre sous « Qui vous êtes » en doré, les libellés en toutes lettres.
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
type Initial = {
  civilite: "mr" | "mme" | null;
  prenom: string;
  nom: string;
  email: string;
  /** Sa photo, là où elle vit (`lireMaPhoto`). */
  photo: string | null;
};

/**
 * Le texte d'invite d'une case vide : l'encre douce, lue au soleil. Une classe
 * et non un style en ligne, parce qu'aucun style en ligne n'atteint
 * `::placeholder` ; et la variable de la charte, pour qu'elle suive Nuit et
 * Sylve.
 */
const INVITE = "placeholder:text-[color:var(--atlas-inkSoft)] placeholder:opacity-80";

export default function CompteClient({ initial }: { initial: Initial }) {
  const [civilite, setCivilite] = useState<"mr" | "mme" | null>(initial.civilite);
  const [prenom, setPrenom] = useState(initial.prenom);
  const [nom, setNom] = useState(initial.nom);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  /** Ce qui n'est pas encore écrit — le bouton du bas DIT cet état (§99). */
  const [aEcrire, setAEcrire] = useState(false);
  const [photo, setPhoto] = useState(initial.photo);
  const [ficheOuverte, setFicheOuverte] = useState(false);

  /**
   * **Ce que le champ porte prime sur l'état**, qui est celui du dernier rendu :
   * la dernière lettre tapée avant de toucher ailleurs pouvait n'y être pas
   * encore, et c'est l'ancien prénom qui partait (`test-valeur-du-champ.ts`).
   */
  function enregistrer(frais: { prenom?: string; nom?: string } = {}) {
    demarrer(async () => {
      const r = await ecrireIdentiteAction({ civilite, prenom: frais.prenom ?? prenom, nom: frais.nom ?? nom });
      setRefus(r.ok ? null : r.raison);
      if (r.ok) setAEcrire(false);
    });
  }

  const identite = { civilite, prenom, nom };
  // Les initiales, à défaut de photo : un rond vide se lit comme un écran
  // cassé. **Et c'est ce rond qui porte la photo** depuis le 27 septembre 2026
  // (« chaque personne doit pouvoir mettre et changer sa photo de profil ») :
  // il reste à sa place, seul son contenu change.
  const initiales = initialesDe(identite, initial.email);
  const affiche = nomAffiche(identite);

  return (
    // `pb-40` : la barre d'enregistrement s'ajoute aux onglets.
    <div className="pb-40">
      {ficheOuverte ? (
        <FichePhoto
          repli={initiales}
          nom={affiche === "" ? initial.email : affiche}
          photo={photo}
          envoyer={(fichier) => {
            const fd = new FormData();
            fd.set("fichier", fichier);
            return poserMaPhotoAction(fd);
          }}
          retirer={retirerMaPhotoAction}
          onPhoto={setPhoto}
          onFermer={() => setFicheOuverte(false)}
        />
      ) : null}
      {refus && (
        <div role="alert" className="mx-[22px] mt-4">
          <PlageTon ton="rouge">{refus}</PlageTon>
        </div>
      )}

      {/* **Le rond et le nom ouvrent la page dans une plage** (sa planche
          soignée). Le petit appareil doré posé sur le rond dit enfin qu'il se
          touche pour mettre sa photo : rien ne le disait, et un geste qu'on ne
          trouve pas n'existe pas. */}
      <div
        className="mx-[22px] mt-[18px] flex items-center gap-4 rounded-[6px] px-[18px] py-4"
        style={{ backgroundColor: colors.card }}
      >
        <button
          type="button"
          data-atlas="ma-photo"
          aria-label="Ma photo"
          onClick={() => setFicheOuverte(true)}
          className="relative flex-none rounded-full"
        >
          <TeteRonde repli={initiales} photo={photo} taille={64} />
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full"
            // Le cerne de la plage détache l'appareil du rond, sur la photo
            // comme sur les initiales.
            style={{ backgroundColor: colors.or, color: surPlein, boxShadow: `0 0 0 3px ${colors.card}` }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3.5" y="6.5" width="17" height="13" rx="2" />
              <path d="M8.5 6.5L10 4h4l1.5 2.5" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </span>
        </button>
        {/* **Le nom seul, sans « Ce compte » dessous.** Sa demande du 26 août
            2026. Un écran qui s'appelle « Mon compte » n'a pas besoin de dire
            sous chaque ligne qu'on y est. */}
        {/* Un nom long passe à la ligne plutôt que d'être coupé : « Compte de
            démonstra… » ne dit plus à qui est le compte. */}
        <span
          className="min-w-0 flex-1"
          style={{ fontFamily: font.display, fontSize: 23, lineHeight: 1.2, color: colors.ink, overflowWrap: "anywhere" }}
        >
          {affiche === "" ? initial.email : affiche}
        </span>
      </div>

      <Paquet titre="Qui vous êtes">
        {/* **LA CIVILITÉ SE CHOISIT, ELLE NE SE TAPE PAS.** Sa demande du
            8 septembre 2026, capture à l'appui : « l'identité comme sur la
            photo avec Mr. Madame nom prénom ». Deux grandes pastilles de 48 px
            plutôt qu'un champ libre — « Mr », « M. », « monsieur » partiraient
            ensuite sur des documents, et rien ne saurait les rapprocher.

            **On peut la retirer** en réappuyant : elle n'est obligatoire nulle
            part, et un choix qu'on ne peut pas défaire se regrette. */}
        <LigneReglage libelle="Civilité">
          <div className="mt-[5px] flex gap-2.5">
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
                  className="h-12 flex-1 rounded-full transition-colors duration-200"
                  style={{
                    fontFamily: font.display,
                    fontSize: 18,
                    backgroundColor: choisie ? colors.plein : "transparent",
                    color: choisie ? surPlein : colors.ink,
                    boxShadow: choisie ? "none" : `inset 0 0 0 1px ${colors.line}`,
                  }}
                >
                  {CIVILITES[code]}
                </button>
              );
            })}
          </div>
        </LigneReglage>

        {/* **Une case vide dit ce qu'elle attend** (sa planche soignée) :
            « Votre prénom », « Votre nom de famille ». Vide et muette, elle
            ressemblait à un trou. */}
        <LigneReglage libelle="Prénom" htmlFor="compte-prenom">
          <input
            id="compte-prenom"
            type="text"
            value={prenom}
            autoComplete="given-name"
            aria-label="Prénom"
            placeholder="Votre prénom"
            onChange={(e) => {
              setPrenom(e.target.value);
              setAEcrire(true);
            }}
            onBlur={(e) => enregistrer({ prenom: e.currentTarget.value })}
            className={INVITE}
            // 16 px au moins : en dessous, iOS agrandit la page à la mise au
            // point et il se retrouve avec un écran zoomé à rétablir à la main.
            style={styleValeurReglage}
          />
        </LigneReglage>

        {/* **« Nom » veut dire NOM DE FAMILLE depuis la migration 0077** — mais
            les comptes d'avant portent ici leur nom complet, et on ne les a pas
            découpés : « Jean-Pierre de La Fontaine » ne se coupe pas par un
            espace. L'écran ne dit rien de tout cela, et c'est voulu : celui qui
            veut séparer les deux le voit en regardant ses deux cases. */}
        <LigneReglage libelle="Nom" htmlFor="compte-nom">
          <input
            id="compte-nom"
            type="text"
            value={nom}
            autoComplete="family-name"
            aria-label="Nom"
            placeholder="Votre nom de famille"
            onChange={(e) => {
              setNom(e.target.value);
              setAEcrire(true);
            }}
            onBlur={(e) => enregistrer({ nom: e.currentTarget.value })}
            className={INVITE}
            style={styleValeurReglage}
          />
        </LigneReglage>

        {/* **Six mots au lieu de quarante — sa demande du 26 août 2026.** Ce
            qui a été retiré, c'est le POURQUOI : rien ne permet de vérifier
            une nouvelle adresse, et une faute de frappe fermerait le compte.
            Cela reste vrai, et c'est sa place ici (`ARCHITECTURE.md`), pas à
            l'écran.

            **Mais la ligne ne disparaît pas**, contrairement à celle du nom :
            un champ qui ne s'ouvre pas quand on le touche se lit comme une
            panne, et il chercherait ce qu'il a mal fait. Le cadenas doré le
            fait voir avant même qu'on la lise (sa planche soignée). */}
        <LigneReglage libelle="E-mail" sous="Sert aussi à vous connecter. Pas encore modifiable.">
          <span className="flex items-center gap-2.5">
            <span className="min-w-0 flex-1" style={{ ...styleValeurReglage, overflowWrap: "anywhere" }}>
              {initial.email}
            </span>
            <svg
              aria-hidden="true"
              focusable="false"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.or}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-none"
            >
              <rect x="5" y="10.5" width="14" height="10" rx="2" />
              <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
            </svg>
          </span>
        </LigneReglage>
      </Paquet>

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
