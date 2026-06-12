---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Embranchements narratifs dans Tellana — histoires avec choix et chemins multiples'
session_goals: 'Explorer toutes les dimensions possibles du système de branches : data model, UX éditeur, expérience lecteur, cas limites, opportunités différenciantes'
selected_approach: 'random-selection'
techniques_used: ['Dream Fusion Laboratory', 'Question Storming', 'Decision Tree Mapping']
ideas_generated: 29
session_active: false
workflow_completed: true
top_priorities: ['Node Canvas Editor', 'Modèle Edge Générique', 'Génération Contenu Scène IA']
---

# Brainstorming Session — Embranchements Narratifs

**Projet :** Tellana
**Date :** 2026-06-12
**Facilitateur :** jck

---

## Session Overview

**Topic :** Embranchements dans les stories Visual Novel — permettre des histoires complètes avec choix narratifs multiples

**Goals :** Explorer toutes les dimensions possibles : modèle de données, UX éditeur, expérience lecteur, cas limites, opportunités différenciantes

### Context Guidance

_Projet Tellana — plateforme Visual Novel (FastAPI + Next.js 16). Modèle actuel : Story → Scenes (linéaires, ordonnées) → Nodes. Les nodes de type "quiz" existent déjà mais sans logique de branchement. L'ajout d'embranchements est la prochaine évolution majeure._

## Technique Selection

**Approche :** Sélection Aléatoire (Random Technique Selection)
**Méthode :** Tirage sérendipiteux depuis 36+ techniques

**Techniques sélectionnées :**

- **Dream Fusion Laboratory** (Theatrical) : Partir de solutions fantastiques impossibles, reverse-engineer vers des étapes concrètes — débloquer l'UX idéale avant les contraintes
- **Question Storming** (Deep) : Générer uniquement des questions pour cartographier l'espace du problème avant de chercher des solutions
- **Decision Tree Mapping** (Structured) : Cartographier tous les chemins de décision pour visualiser l'architecture des choix narratifs

**Arc de la session :** Rêve → Doutes → Architecture

---

## Idées Générées — Inventaire Complet

### Theme 1 — Canvas & Graphe Narratif

**[Canvas #1] Node Canvas Editor**
_Concept_ : Interface 2D type ComfyUI remplaçant la liste ordonnée de scènes. Les scènes sont des nœuds reliés par des arêtes sur un canvas libre. L'architecture narrative devient visible et manipulable d'un coup d'œil.
_Novelty_ : Passage d'un paradigme séquentiel (liste) à un paradigme spatial (carte) — l'auteur pense son histoire comme un graphe, pas comme un script.

**[Graph #8] Deux Types de Connexions**
_Concept_ : Le canvas supporte deux liens : Scène → Scène directe (enchaînement automatique) et Scène → Nœud Embranchement → N Scènes (décision lecteur). La topologie porte le sens visuellement.
_Novelty_ : Pas d'interface spéciale — la forme de la connexion distingue enchaînement et décision.

**[Graph #10] Graphe Narratif Libre**
_Concept_ : Topologie totalement libre — fins multiples, convergences vers une scène commune, ou les deux mélangés. Aucune contrainte de forme imposée par l'outil.
_Novelty_ : Vrai graphe orienté, pas une arborescence ou une structure linéaire avec variantes.

**[Node #2] Nœud Embranchement**
_Concept_ : Nœud spécial avec N outputs nommés (max 4-5). Chaque output pointe vers une scène ou un autre nœud embranchement. Overlay de choix affiché en superposition de la dernière scène jouée.
_Novelty_ : L'embranchement est intrinsèque au flow — le lecteur décide dans le contexte naturel du récit.

**[Graph #15] Nœud Fin avec Richesse Narrative**
_Concept_ : Nœuds de fin typés (bonne/mauvaise fin) avec image d'illustration, texte de conclusion, musique (future). Expérience de clôture émotionnellement distincte selon le chemin parcouru.
_Novelty_ : La fin est scénarisée au même titre qu'une scène — pas un simple "Game Over".

**[Graph #16] Nœud Début — Marqueur d'Entrée**
_Concept_ : Marqueur unique désignant la scène de départ. Un seul par story. Point d'entrée explicite visible dans le canvas.
_Novelty_ : Rend l'intention de l'auteur explicite — on voit immédiatement où l'histoire commence.

**[Design #18] Graphe Permissif — Mode Brouillon**
_Concept_ : Aucune validation en édition — scènes isolées, chemins incomplets, nœuds orphelins acceptés. Validation uniquement à la publication, sous forme d'avertissements non bloquants.
_Novelty_ : Le canvas est un espace de travail créatif, pas un formulaire — l'auteur peut penser à voix haute dans le graphe.

**[Canvas #19] Navigation Canvas Riche**
_Concept_ : Minimap permanente, zoom molette + boutons (accessibilité), groupes visuels pour délimiter chapitres ou arcs narratifs. Les groupes sont des conteneurs visuels, pas une hiérarchie de données.
_Novelty_ : Lecture macro (chapitres) et micro (scènes + connexions) dans la même vue.

**[UX #20] Canvas comme Hub de Navigation**
_Concept_ : Double-clic sur nœud Scène → navigation vers la page d'édition existante (preview, personnages, décors, nodes). Retour au canvas via bouton de navigation. Deux modes clairs.
_Novelty_ : Respecte la profondeur de l'éditeur de scène actuel sans le compromettre.

**[Graph #23] Modèle Edge Générique**
_Concept_ : Table `Edge(source_id, source_type, target_id, target_type, label?)` représentant toutes les connexions. Extensible à tout type de nœud futur sans migration de schéma.
_Novelty_ : Sépare proprement topologie (connexions) et sémantique (types de nœuds).

**[Design #24] Limite 4-5 Choix par Embranchement**
_Concept_ : Maximum 4-5 sorties par nœud embranchement — contraint par l'UI overlay.
_Novelty_ : La contrainte UI devient une contrainte narrative saine — au-delà de 5 choix, la décision perd son sens pour le lecteur.

**[Graph #29] Embranchements en Cascade**
_Concept_ : Un nœud embranchement peut pointer directement vers un autre nœud embranchement. Le player enchaîne les overlays sans scène intermédiaire.
_Novelty_ : Permet des arbres de décision en cascade ("Tu acceptes ?" → "Alors, comment ?") sans alourdir le graphe.

---

### Theme 2 — IA Générative

**[Character #6] Biographie Personnage comme Prompt Système**
_Concept_ : Champ "Biographie" libre sur le personnage. Double usage : documentation pour l'auteur ET prompt système IA pour toutes les scènes impliquant ce personnage.
_Novelty_ : Story Bible machine-readable — la biographie est écrite une fois, utilisée partout.

**[AI #5] Contexte de Génération Structuré**
_Concept_ : Le prompt IA combine : biographies des personnages impliqués + position dans le graphe (scènes entrantes/sortantes) + titre et description de la scène.
_Novelty_ : La structure narrative elle-même devient du contexte — pas juste un prompt libre.

**[Design #7] Scènes Narrativement Autosuffisantes**
_Concept_ : Chaque scène fonctionne quel que soit le chemin d'arrivée. La cohérence repose sur biographies + description, pas sur une mémoire de parcours.
_Novelty_ : Contrainte créative assumée qui simplifie radicalement le modèle et la génération IA.

**[AI #3] Génération Architecture IA**
_Concept_ : L'IA génère un squelette narratif complet (nœuds + connexions + arcs) depuis un prompt résumé. L'auteur affine ensuite manuellement.
_Novelty_ : Sépare "générer l'ossature" de "remplir le contenu" — approche rare dans les outils VN.

**[AI #12] Modal de Configuration Génération IA**
_Concept_ : Modale avec 3 paramètres : longueur souhaitée, humeur de chaque personnage présent (liste + champ libre), objectif narratif de fin de scène.
_Novelty_ : L'humeur par personnage est un vecteur de direction créative précis — pas "génère une scène triste" mais "Jean est en colère, Marie est résignée".

**[AI #13] Objectif Narratif comme Ancrage de Fin**
_Concept_ : Le champ "où doit mener la scène" force l'IA à construire une progression dramatique avec une destination précise.
_Novelty_ : Génération avec arc début→fin défini — rare dans les générateurs de dialogue.

**[AI #14] Workflow Génération Hybride**
_Concept_ : Post-génération : régénérer depuis la modale (ajuster paramètres) OU retoucher les nodes directement dans l'éditeur. L'auteur choisit selon l'ampleur de l'insatisfaction.
_Novelty_ : La génération IA est un "premier jet intelligent", pas une sortie définitive.

---

### Theme 3 — Player & Expérience Lecteur

**[Player #9] Embranchement comme Overlay de Choix**
_Concept_ : Boutons de choix en superposition de la dernière scène jouée. Pas de rupture visuelle — la décision émerge naturellement dans le contexte de la scène.
_Novelty_ : L'embranchement est invisible dans l'expérience — c'est un moment de décision, pas une scène.

**[Player #21] Preloader de Story**
_Concept_ : Écran de chargement préchargeant tous les assets et le graphe narratif complet avant le lancement. Lecture sans latence.
_Novelty_ : Le lecteur attend une fois au début plutôt que de subir des micro-freezes à chaque transition.

**[Player #22] Progression Sauvegardée en Local**
_Concept_ : Scène courante, choix effectués, chemin parcouru persistés en localStorage. Reprise exacte à la prochaine visite. Zéro compte, zéro serveur.
_Novelty_ : Cohérent avec l'approche local-first de Tellana — zéro friction.

**[Player #11] Replay Optionnel**
_Concept_ : Le lecteur peut revenir à un point de décision passé pour explorer une autre branche. Activable/désactivable par l'auteur pour la story.
_Novelty_ : L'auteur contrôle le "feeling" — exploration encouragée (éducatif) ou choix définitifs (thriller).

**[Design #27] Différenciation Visuelle des Choix Explorés — Option par Nœud**
_Concept_ : Choix déjà empruntés visuellement marqués (couleur, opacité) par défaut. Option configurable par nœud embranchement pour désactiver cette différenciation.
_Novelty_ : Même mécanique pour deux intentions opposées — explorer ou préserver le mystère.

**[Design #28] JSON Embarqué dans ZIP**
_Concept_ : À la publication, graphe complet sérialisé en JSON dans le ZIP standalone. Player navigue entièrement côté client — zéro dépendance backend pendant la lecture.
_Novelty_ : Story publiée fonctionnelle hors ligne, cohérente avec l'approche local-first.

---

### Theme 4 — Workflow Auteur

**[UX #26] Play From Canvas**
_Concept_ : Bouton "Tester" dans le canvas lançant la story depuis le nœud de début, scènes vides = placeholder. Valide le flow narratif indépendamment du contenu.
_Novelty_ : Sépare validation architecture et validation contenu — itérer sur le graphe avant d'écrire une ligne.

**[Design #25] Table Rase — Refonte Sans Migration**
_Concept_ : Prototype sans stories existantes — nouveau modèle de graphe remplace entièrement le système linéaire. Zéro dette de compatibilité.
_Novelty_ : Liberté totale de conception du schéma de données.

**[Future #17] Audio comme Couche Future**
_Concept_ : Musique d'ambiance par scène, sound FX sur interactions — scope séparé post-embranchements.
_Novelty_ : Décision de ne pas l'inclure dans ce scope — évite la dette feature.

---

### Questions Ouvertes (Question Storming)

1. Doit-on limiter le nombre d'options sur un nœud embranchement ? → **Décidé : 4-5 max**
2. Comment l'auteur nomme-t-il les sorties dans le canvas — même texte que le label lecteur ?
3. Que se passe-t-il si l'IA génère une scène sans description renseignée ?
4. Comment le graphe est-il stocké côté backend ? → **Décidé : modèle Edge générique**
5. Les stories existantes sont-elles compatibles ? → **Décidé : table rase**
6. Comment l'auteur teste-t-il sans contenu complet ? → **Décidé : Play From Canvas**
7. Comment visualise-t-on qu'une scène n'a pas de contenu généré ?
8. Le nœud embranchement a-t-il un titre visible dans le canvas pour l'auteur ?
9. Peut-on connecter un branch → branch directement ? → **Décidé : oui**
10. Comment gérer la traduction des labels de choix ?
11. Le replay différencie-t-il visuellement les choix explorés ? → **Décidé : oui, configurable**
12. Comment l'export ZIP embarque-t-il le graphe ? → **Décidé : JSON sérialisé**

---

## Organisation et Prioritisation

### Top 3 Priorités

**#1 — Node Canvas Editor** *(fondation UX)*
Sans interface canvas, le reste n'a pas de surface de travail.

**#2 — Modèle Edge Générique** *(fondation data)*
La table `Edge` extensible est le socle de toute l'architecture graphe.

**#3 — Modal Génération Contenu Scène IA** *(valeur différenciante)*
La feature qui distingue Tellana de tous les autres éditeurs VN.

---

## Plans d'Action

### Plan #1 — Modèle Edge Générique *(à faire en premier)*

1. Créer tables `graph_nodes(id, story_id, type, position_x, position_y, data)` et `graph_edges(id, story_id, source_id, source_type, target_id, target_type, label?)`
2. Endpoints CRUD nœuds et arêtes
3. `GET /stories/{id}/graph` — graphe complet sérialisé
4. Adapter publication : sérialisation JSON dans le ZIP
**Timeline :** 2-3 jours backend

### Plan #2 — Node Canvas Editor *(après backend)*

1. Intégrer **React Flow** (librairie canvas pour Next.js)
2. Créer page `/stories/[id]/canvas` avec types : `scene`, `branch`, `end`, `start`
3. Drag & drop + connexions entre nœuds
4. Minimap, zoom molette, groupes
5. Double-clic nœud Scène → navigation éditeur existant
**Timeline :** 3-4 jours frontend

### Plan #3 — Modal Génération IA *(après canvas)*

1. Ajouter champ `biography` sur `Character`
2. Créer modal : longueur + humeur par personnage + objectif narratif
3. Endpoint `POST /scenes/{id}/generate` — compose prompt + appel API Claude
4. Nodes générés insérés dans la scène, éditables immédiatement
**Timeline :** 2-3 jours (backend + frontend + intégration Claude API)

### Séquence recommandée

```
Semaine 1 : Modèle Edge (backend)
Semaine 2 : Node Canvas Editor (frontend)
Semaine 3 : Biographies + Modal Génération IA
```

---

## Résumé de Session

**29 idées générées** à travers 3 techniques complémentaires.

**Décisions architecturales prises :**
- Graphe générique avec modèle Edge extensible
- Scènes narrativement autosuffisantes (pas d'état de parcours)
- Limite 4-5 choix par embranchement (contrainte UI → contrainte narrative)
- Table rase (pas de migration)
- Export JSON standalone dans le ZIP
- Sauvegarde progression en localStorage
- Replay et différenciation choix explorés configurables par nœud

**Percée principale :** La séparation nette architecture / contenu — l'auteur construit le graphe narratif d'abord, génère ou écrit le contenu ensuite. Deux niveaux d'abstraction distincts, deux workflows distincts.

**Valeur différenciante de Tellana :** Un éditeur VN avec IA générative contextuelle (biographies personnages + structure narrative) — rare sur le marché des outils Visual Novel.

