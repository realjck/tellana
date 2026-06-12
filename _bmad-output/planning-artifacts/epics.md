---
stepsCompleted: [1]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-tellana-2026-06-13/prd.md
---

# Tellana - Epic Breakdown (TEL-24)

## Requirements Inventory

### Functional Requirements

FR-1.1: Créer les tables `graph_nodes` et `graph_edges` au démarrage (pattern migration safe)
FR-1.2: Champ `data` JSON typé par type de nœud (start/scene/branch/end)
FR-1.3: Endpoints CRUD — POST/PATCH/DELETE nodes, POST/DELETE edges
FR-1.4: GET /stories/{id}/graph — graphe complet sérialisé
FR-1.5: Contraintes backend — nœud start unique par story (400), max 5 edges sortantes par branch (400)
FR-1.6: Script reset_db.py — suppression propre des données existantes
FR-2.1: Page /stories/[id]/canvas avec React Flow — point d'entrée principal de la story
FR-2.2: Types de nœuds visuels distincts (start, scene, branch, end)
FR-2.3: Clic gauche canvas vide → menu Scène/Embranchement/Fin → création atomique (Scene en DB + graph_node, titre auto-numéroté)
FR-2.4: Renommage inline — clic sur titre de nœud sélectionné → champ éditable, Enter confirme, sync DB
FR-2.5: Double-clic sur corps de nœud scene → éditeur de scène existant, retour canvas via navbar
FR-2.6: Connexions drag & drop entre handles, label éditable inline (obligatoire pour source branch)
FR-2.7: Minimap permanente + zoom molette
FR-2.8: Graphe permissif — nœuds orphelins et chemins incomplets acceptés
FR-2.9: Bouton "Tester" → player depuis nœud start, scènes vides avec placeholder
FR-2.10: Auto-save debounce 500ms sur positions et connexions
FR-3.1: Player charge GET /graph et navigue à partir du nœud start
FR-3.2: Overlay de choix sur nœud branch — boutons triés par order, max 5
FR-3.3: Écran de fin typé (good/bad/neutral) avec titre + texte + bouton Recommencer
FR-3.4: Embranchements en cascade branch→branch (overlays enchaînés sans scène intermédiaire)
FR-3.5: Sauvegarde localStorage — currentNodeId + visitedEdgeIds[], reprise exacte
FR-3.6: Replay par nœud branch (replay: bool dans data) — désactivé par défaut
FR-3.7: show_visited par nœud branch (show_visited: bool dans data) — activé par défaut
FR-4.1: Export ZIP et publish incluent graph.json (sortie de GET /graph)
FR-4.2: Player bundle standalone lit graph.json côté client
FR-4.3: localStorage opérationnel dans la version publiée

### NonFunctional Requirements

NFR-1: Canvas fluide jusqu'à ~50 nœuds (scope prototype, SQLite)
NFR-2: Nœud scene avec scène supprimée affiché "scène manquante" sans casser le graphe
NFR-3: Pas d'authentification — périmètre prototype inchangé

### Additional Requirements

- React Flow (@xyflow/react) à installer comme dépendance frontend
- Script reset_db.py à créer à la racine backend/
- Canvas remplace la liste linéaire de scènes comme point d'entrée de la story
- Pas de migration — table rase des stories et nodes existants

### UX Design Requirements

N/A — pas de document UX formel pour cette epic

### FR Coverage Map

| Ticket | FRs couverts |
|--------|-------------|
| TEL-25 | FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.5, FR-1.6, FR-4.1 |
| TEL-26 | FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7, FR-2.8, FR-2.9, FR-2.10 |
| TEL-27 | FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.5, FR-3.6, FR-3.7, FR-4.2, FR-4.3 |

## Epic List

- TEL-24 (Epic) — Embranchements narratifs (à mettre à jour)
- TEL-25 (Task) — Backend : modèle de graphe (à mettre à jour)
- TEL-26 (Task) — Frontend : canvas éditeur (à mettre à jour)
- TEL-27 (Task) — Player : traversée du graphe (à mettre à jour)
- TEL-28 (Task) — IA : hors scope TEL-24, à déplacer vers epic futur

## Delta par ticket

### TEL-24 (Epic) — à corriger
- Titre : retirer "génération IA"
- Description : retirer IA du périmètre, marquer explicitement hors scope
- Mettre à jour les décisions architecturales (edges simplifiés)
- Fermer les questions ouvertes (toutes répondues dans le PRD)

### TEL-25 (Backend) — à corriger
- graph_edges : supprimer source_type/target_type → source_node_id/target_node_id + order
- data : clarifier structure par type (FR-1.2)
- Contrainte start unique : ajouter
- Max 5 (pas "4-5") : clarifier
- Ajouter : script reset_db.py

### TEL-26 (Canvas) — à corriger
- Retirer : Groupes visuels (hors scope PRD)
- Retirer : boutons zoom accessibilité (hors scope PRD)
- Ajouter : clic gauche → menu déroulant (FR-2.3)
- Ajouter : titre auto-numéroté + renommage inline (FR-2.3, FR-2.4)
- Clarifier : StartMarker auto-créé à l'init (non proposé dans le menu)
- Clarifier : double-clic sur le CORPS du nœud → éditeur (pas le titre)
- Ajouter : canvas = point d'entrée principal (remplace vue scènes linéaire)

### TEL-27 (Player) — à corriger
- Retirer : section Preloader entière (hors scope PRD)
- Corriger : replay = par nœud branch (replay: bool dans data), pas par story
- Corriger : show_visited = par nœud branch (show_visited: bool dans data)
- Ajouter : cascade branch→branch explicite (FR-3.4)
- Clarifier : localStorage = currentNodeId + visitedEdgeIds[]

### TEL-28 (IA) — à déplacer
- Titre : retirer "[4/4]", marquer "hors scope TEL-24 — epic futur"
- Description : préciser que c'est reporté, pas abandonné
