"use client";

import { useEffect, useState } from "react";
import { colors } from "@/lib/design-tokens";
import type { JourIso } from "@/lib/disponibilites";
import { ChampRecherche } from "@/components/atlas/ChampRecherche";
// **Les types se prennent par `import type`, jamais dans l'import des actions.**
// Un fichier « use server » réexporté par Next ne laisse survivre que des
// valeurs ; un nom de type y meurt à l'évaluation et emporte TOUTES les actions
// de l'écran (`scripts/test-actions-serveur-sans-export-de-type.ts`).
import type { ClientProposé, QuandPoser } from "./actions";
import { chercherDesClientsAction, poserUnClientAction, poserDuTempsAction } from "./actions";
import type { ChantierPlanning } from "./types-du-planning";
import { Choisir, Petit } from "./ElementsDuPlanning";
import { BasculeDuMoment } from "./BasculeDuMoment";

/**
 * LE DESSIN DES CHAMPS DE CET ÉCRAN, écrit une fois pour les trois voies.
 *
 * **Repris du pense-bête du chantier**, qui vit dans la même carte : même
 * rayon, même filet, même fond. Un second style aurait donné deux façons de
 * dessiner un champ à trois centimètres d'écart.
 */
const CHAMP = "mt-2 w-full rounded-[9px] border-0 px-3 py-3 outline-none";

const STYLE_CHAMP = {
  boxShadow: `inset 0 0 0 1px ${colors.line}`,
  background: colors.card,
  color: colors.ink,
  minHeight: 48,
  // **16 px au moins.** En dessous, iOS grossit la page à la mise au point et
  // l'écran saute sous le doigt — un piège déjà payé sur le pense-bête.
  fontSize: 16,
} as const;

/**
 * DU TEMPS QUI N'EST PAS UN CLIENT — la banque, une livraison, une formation.
 *
 * **Sa réponse du 10 septembre 2026**, à la question que sa propre correction
 * avait ouverte : la troisième entrée existe.
 *
 * **Un seul champ, et rien d'autre.** Il n'y a personne à reconnaître, aucune
 * fiche à créer, aucune adresse à rejoindre : ce qu'on écrit EST le nom de ce
 * qui prend la place. Passer par le chemin du client aurait fait chercher un
 * homonyme à « Banque », et proposé de lui créer une fiche.
 */
export function AjoutDeTemps({
  jour,
  onAnnuler,
  onPose,
}: {
  jour: JourIso;
  onAnnuler: () => void;
  onPose: (chantier: ChantierPlanning) => void;
}) {
  const [quoi, setQuoi] = useState("");
  const [quand, setQuand] = useState<QuandPoser>("matin");
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const pret = quoi.trim().length >= 2 && !enCours;

  return (
    <div className="mt-3.5 pt-3">
      <input
        data-atlas="quoi-cest"
        autoFocus
        value={quoi}
        onChange={(e) => setQuoi(e.target.value)}
        placeholder="Rendez-vous à la banque, livraison…"
        className={CHAMP}
        style={STYLE_CHAMP}
      />
      <BasculeDuMoment retenu={quand} onChoisir={setQuand} repere="quand-poser" />
      {refus && (
        <p data-atlas="refus-du-geste" className="mt-2 text-[13px]" style={{ color: colors.bordeaux }}>
          {refus}
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <Petit data-atlas="annuler-ajout" onClick={onAnnuler}>
          Annuler
        </Petit>
      </div>
      <div className="mt-2 flex justify-end">
        <Petit
          data-atlas="poser-le-temps"
          retenue={pret}
          onClick={() => {
            if (!pret) return;
            setEnCours(true);
            poserDuTempsAction(jour, quand, quoi)
              .then((r) => {
                setEnCours(false);
                if (r.succes) onPose(r.chantier);
                else {
                  console.error("Temps refusé", { jour, quand, erreur: r.erreur });
                  setRefus(r.erreur);
                }
              })
              .catch((e) => {
                console.error("Temps parti dans le vide", e);
                setEnCours(false);
                setRefus("Rien n'est parti. Rechargez la page.");
              });
          }}
        >
          {enCours ? "…" : "Poser"}
        </Petit>
      </div>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POSER UN CLIENT SUR CE JOUR — sans fiche à remplir d'avance, sans devis
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Sa demande du 10 septembre 2026**, planche `appli/bloquer-sans-devis.html` :
 * *« si j'ai un chantier à rajouter ou quelque chose, que je puisse le faire
 * sans devoir passer par la fiche client et le devis »*, puis *« si le client
 * n'est pas reconnu, il faut qu'il ajoute aussi sa fiche client automatiquement,
 * comme quand on ajoute un client par la voie normale »*.
 *
 * **Trois états, et un seul écran** : on tape un nom ; s'il est connu on le
 * touche, sinon les trois cases de sa fiche s'ouvrent. Puis matin, après-midi
 * ou la journée — et c'est posé.
 *
 * **« Journée » existe ICI et nulle part ailleurs**, et ce n'est pas une
 * exception oubliée : partout ailleurs le moment réécrivait ce que le devis
 * avait vendu (le défaut du 9 septembre). Ici, le chantier naît de ce geste :
 * le choix EST sa durée, il ne recouvre rien.
 */
export function AjoutDunClient({
  jour,
  onAnnuler,
  onPose,
}: {
  jour: JourIso;
  onAnnuler: () => void;
  onPose: (chantier: ChantierPlanning) => void;
}) {
  const [saisie, setSaisie] = useState("");
  /**
   * LA DERNIÈRE RÉPONSE DU SERVEUR, ET LE MOT QU'ELLE CONCERNE.
   *
   * **Garder le mot avec sa réponse est ce qui rend la liste honnête.** Une
   * simple liste de clients affiche, le temps d'un aller-retour, les résultats
   * du mot d'AVANT — et l'écran annonce alors « Inconnu » sur un nom qu'il
   * connaît, ou l'inverse. Ici, ce qui ne répond pas à ce qui est tapé n'est
   * pas montré.
   */
  const [reponse, setReponse] = useState<{ mot: string; clients: ClientProposé[] }>({
    mot: "",
    clients: [],
  });
  const [retenu, setRetenu] = useState<ClientProposé | null>(null);
  const [fiche, setFiche] = useState({ telephone: "", email: "", adresse: "" });
  const [quand, setQuand] = useState<QuandPoser>("matin");
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  /**
   * **La recherche part au SERVEUR, et elle attend qu'il s'arrête d'écrire.**
   *
   * Sans ce délai, chaque frappe ferait un aller-retour — huit requêtes pour
   * « Bernard », dont sept que personne ne lit. Et les réponses ne reviennent
   * pas dans l'ordre où elles partent : la liste afficherait par instants les
   * résultats d'un mot déjà effacé.
   */
  const mot = saisie.trim();
  useEffect(() => {
    if (retenu) return;
    if (mot.length < 2) return;
    let vivant = true;
    const minuteur = setTimeout(() => {
      chercherDesClientsAction(mot)
        .then((clients) => {
          if (vivant) setReponse({ mot, clients });
        })
        // **UNE RECHERCHE QUI TOMBE NE DOIT PAS FERMER LA FICHE.** Sans ce
        // rattrapage, la réponse n'arrivait jamais, « on cherche encore »
        // restait vrai pour toujours, et les trois cases de la fiche ne
        // s'ouvraient PLUS JAMAIS — sa panne du 11 septembre 2026, sur une page
        // qui avait survécu à son serveur. On rend alors une liste vide : il
        // est inconnu, ce qui est le cas le plus utile, et il peut écrire.
        .catch((e) => {
          console.error("Recherche de client partie dans le vide", e);
          if (vivant) setReponse({ mot, clients: [] });
        });
    }, 250);
    return () => {
      vivant = false;
      clearTimeout(minuteur);
    };
  }, [mot, retenu]);

  /** Ce que le serveur a répondu POUR CE MOT — rien d'autre ne s'affiche. */
  const trouves = reponse.mot === mot ? reponse.clients : [];
  /** On interroge encore : ni liste, ni verdict. */
  const cherche = mot.length >= 2 && reponse.mot !== mot;
  // **« Inconnu » n'apparaît qu'une fois la réponse arrivée.** Sans cette
  // attente, la phrase clignoterait à chaque lettre — et un client connu se
  // verrait annoncer comme inconnu le temps d'un aller-retour.
  const inconnu = retenu === null && !cherche && trouves.length === 0 && mot.length >= 2;
  const pret = (retenu !== null || mot.length >= 2) && !enCours;

  function poser() {
    if (!pret) return;
    setEnCours(true);
    poserUnClientAction(jour, quand, {
      nom: retenu?.nom ?? saisie,
      // **On n'envoie SA saisie que pour un client inconnu.** Sur un client
      // reconnu, ces cases ne sont pas à l'écran : envoyer leur contenu
      // reviendrait à écrire dans sa fiche ce qu'il n'a pas relu.
      ...(inconnu ? fiche : {}),
    })
      .then((r) => {
        setEnCours(false);
        if (r.succes) onPose(r.chantier);
        else {
          console.error("Pose d'un client refusée", { jour, quand, erreur: r.erreur });
          setRefus(r.erreur);
        }
      })
      // **Un appui sans effet et sans message est un défaut muet** : c'est ce
      // qu'il a vu le 11 septembre 2026. Le `.then()` seul n'attrape rien quand
      // la promesse est REJETÉE — une page qui a survécu à son serveur poste
      // dans le vide.
      .catch((e) => {
        console.error("Pose d'un client partie dans le vide", e);
        setEnCours(false);
        setRefus("Rien n'est parti. Rechargez la page.");
      });
  }


  return (
    <div className="mt-3.5 pt-3">
      <ChampRecherche
        dataAtlas="nom-du-client"
        autoFocus
        valeur={saisie}
        onChange={(v) => {
          setSaisie(v);
          setRetenu(null);
        }}
        placeholder="Nom du client"
        ariaLabel="Nom du client"
        className="mt-2"
      />

      {retenu ? (
        <p data-atlas="client-retenu" className="mt-2 text-[13px]" style={{ color: colors.inkSoft }}>
          {retenu.nom}
          <span className="block" style={{ color: colors.muted }}>
            {retenu.telephone || "sans numéro"} · {retenu.adresse || "sans adresse"}
          </span>
        </p>
      ) : trouves.length > 0 ? (
        <Choisir>
          {trouves.map((c) => (
            <Petit
              key={c.id}
              data-atlas="client-trouve"
              onClick={() => {
                setRetenu(c);
                setSaisie(c.nom);
              }}
            >
              {c.nom}
            </Petit>
          ))}
        </Choisir>
      ) : inconnu ? (
        /* **Inconnu : on ne refuse pas, on ouvre sa fiche.** Sa demande du
           10 septembre — le numéro et l'adresse s'écrivent ici, une fois, et
           la fiche existe ensuite comme les autres. */
        <>
          <p data-atlas="fiche-a-creer" className="mt-2 text-[13px]" style={{ color: colors.inkSoft }}>
            Inconnu, sa fiche sera créée
          </p>
          {(
            [
              ["telephone", "Téléphone"],
              ["email", "E-mail"],
              ["adresse", "Adresse du chantier"],
            ] as const
          ).map(([champName, mot]) => (
            <input
              key={champName}
              data-atlas={`fiche-${champName}`}
              value={fiche[champName]}
              onChange={(e) => setFiche((f) => ({ ...f, [champName]: e.target.value }))}
              placeholder={mot}
              className={CHAMP}
              style={STYLE_CHAMP}
            />
          ))}
        </>
      ) : null}

      {/* **Le même interrupteur que « qui n'est pas là »**, à un repère près :
          la question est la même — matin, après-midi, ou la journée. */}
      <BasculeDuMoment retenu={quand} onChoisir={setQuand} repere="quand-poser" />

      {refus && (
        <p data-atlas="refus-du-geste" className="mt-2 text-[13px]" style={{ color: colors.bordeaux }}>
          {refus}
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <Petit data-atlas="annuler-ajout" onClick={onAnnuler}>
          Annuler
        </Petit>
      </div>

      <div className="mt-2 flex justify-end">
        <Petit data-atlas="poser-le-client" onClick={poser} retenue={pret}>
          {enCours ? "…" : "Poser"}
        </Petit>
      </div>
    </div>
  );
}
