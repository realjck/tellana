---
title: "PRD — Embranchements narratifs (TEL-24)"
status: final
created: 2026-06-13
updated: 2026-06-13
epic: TEL-24
author: jck
---

# PRD — Embranchements narratifs (TEL-24)

## Vision

Permettre à l'auteur de Tellana de créer des histoires à choix multiples — graphe narratif avec branches, fins multiples et sauvegarde de progression — sans dépendance à l'IA générative (scope TEL-24 uniquement).

---

## Contexte

Le modèle actuel de Tellana est strictement linéaire : Story → Scenes ordonnées → Nodes. Les nodes `quiz` existent mais sans logique de branchement. TEL-24 remplace ce modèle par un graphe narratif éditable visuellement, jouable dans le player, et publiable en ZIP standalone.

**Décision irréversible :** les stories existantes sont supprimées via un script manuel `reset_db.py`. Pas de migration. Le nouveau schéma remplace entièrement l'ancien.

---

## Périmètre

**Dans ce scope :**
- Modèle backend graphe (`graph_nodes` + `graph_edges`)
- Canvas éditeur (React Flow) — remplace la vue scènes linéaire
- Player avec overlay de choix et sauvegarde localStorage
- Publication ZIP avec graphe JSON embarqué

**Hors scope TEL-24 :**
- IA générative (biographies personnages, modal génération Claude) → Epic suivant
- Audio / musique d'ambiance
- Traduction des labels de choix

---

## Fonctionnalités

### F-1 — Modèle de graphe (Backend)

**FR-1.1** Créer les tables `graph_nodes` et `graph_edges` au démarrage (pattern migration safe existant).

```
graph_nodes(id, story_id, type, position_x, position_y, data JSON, created_at, updated_at)
  type : "start" | "scene" | "branch" | "end"

graph_edges(id, story_id, source_node_id, target_node_id, label, order)
  label : texte du choix affiché au lecteur (quand source = "branch")
  order : ordre d'affichage des choix d'un même nœud branch
```

**FR-1.2** Contenu du champ `data` par type de nœud :
- `start` — `{}`
- `scene` — `{ "scene_id": int }`
- `branch` — `{ "title": str|null, "replay": bool, "show_visited": bool }`
- `end` — `{ "type": "good"|"bad"|"neutral", "title": str, "text": str }`

**FR-1.3** Endpoints CRUD :
- `POST /stories/{id}/graph/nodes` — créer un nœud
- `PATCH /stories/{id}/graph/nodes/{node_id}` — modifier position ou data
- `DELETE /stories/{id}/graph/nodes/{node_id}` — supprimer + cascade edges associées
- `POST /stories/{id}/graph/edges` — créer une arête
- `DELETE /stories/{id}/graph/edges/{edge_id}` — supprimer une arête

**FR-1.4** `GET /stories/{id}/graph` — retourne le graphe complet sérialisé `{ nodes: [...], edges: [...] }`.

**FR-1.5** Contraintes validées backend :
- Nœud `start` : unique par story (HTTP 400 si déjà existant)
- Nœud `branch` : max 5 edges sortantes (HTTP 400 au-delà)

---

### F-2 — Canvas éditeur (Frontend)

**FR-2.1** Page `/stories/[id]/canvas` avec **React Flow** — point d'entrée principal de la story, remplace la liste linéaire de scènes.

**FR-2.2** Types de nœuds visuels distincts :
- `start` — point d'entrée unique, non supprimable
- `scene` — affiche titre de la scène + thumbnail
- `branch` — affiche titre optionnel + labels des edges sortantes
- `end` — affiche type (bonne/mauvaise/neutre) + titre

**FR-2.3** Création de nœuds par **clic gauche sur zone vide du canvas** → menu déroulant : Scène / Embranchement / Fin. Le nœud est positionné à l'endroit du clic.
- Choisir "Scène" crée atomiquement une `Scene` en DB (titre auto-numéroté "Scène N") + le `graph_node` de type `scene` associé.
- Le nœud `start` est créé automatiquement à l'initialisation du canvas (non proposé dans le menu, unique par story).

**FR-2.4** Renommage inline : **clic sur le titre** d'un nœud sélectionné → champ de texte éditable, Enter pour confirmer. Pour les nœuds `scene`, le titre est synchronisé avec celui de la `Scene` en DB.

**FR-2.5** Navigation vers l'éditeur de scène : **double-clic sur le corps** d'un nœud `scene` → `/stories/[id]/scenes/[scene_id]/edit`. Retour au canvas via bouton navbar.

**FR-2.6** Connexions drag & drop entre handles de nœuds. Le champ `label` de l'arête est éditable inline sur la connexion (obligatoire quand source = `branch`, optionnel sinon).

**FR-2.7** Minimap permanente + zoom molette.

**FR-2.8** Graphe permissif : nœuds orphelins, chemins incomplets et scènes vides acceptés en édition. Pas de validation bloquante.

**FR-2.9** Bouton "Tester" dans le canvas → lance le player depuis le nœud `start`. Scènes vides affichées avec un placeholder.

**FR-2.10** Sauvegarde automatique des positions et connexions à chaque modification (debounce 500 ms).

---

### F-3 — Player branching (Frontend)

**FR-3.1** Le player charge `GET /stories/{id}/graph` et navigue selon les edges à partir du nœud `start`. Chaque nœud `scene` joue la scène liée via le player existant.

**FR-3.2** Nœud `branch` : overlay de choix en superposition de la dernière scène jouée — boutons correspondant aux edges sortantes triées par `order`. Max 5 boutons.

**FR-3.3** Nœud `end` : écran de fin distinct selon le type (`good`/`bad`/`neutral`) avec titre + texte + bouton Recommencer (retour au nœud `start`).

**FR-3.4** Embranchements en cascade (`branch` → `branch`) : les overlays s'enchaînent sans scène intermédiaire.

**FR-3.5** Sauvegarde localStorage : `node_id` courant + liste des edge ids parcourus. Reprise exacte à la prochaine visite.

**FR-3.6** Replay : si `replay: true` sur un nœud `branch`, le lecteur peut revenir à ce point depuis l'interface. Désactivé par défaut.

**FR-3.7** Différenciation visuelle des choix déjà empruntés (couleur/opacité) si `show_visited: true` sur le nœud `branch`. Activé par défaut.

---

### F-4 — Publication

**FR-4.1** `GET /stories/{id}/export-zip` et `POST /stories/{id}/publish` incluent `graph.json` (sortie de `GET /stories/{id}/graph`) dans le ZIP.

**FR-4.2** Le player bundle standalone charge `graph.json` et navigue entièrement côté client — zéro appel backend pendant la lecture.

**FR-4.3** Sauvegarde localStorage opérationnelle dans la version publiée (même clé, même logique).

---

## Exigences non fonctionnelles

- **Performance canvas :** fluide jusqu'à ~50 nœuds (scope prototype).
- **Résilience graphe :** un nœud `scene` dont la scène liée est supprimée est affiché "scène manquante" sans casser le graphe.
- **Pas d'authentification :** périmètre prototype inchangé.

---

## Critères de succès

1. L'auteur crée un graphe start → scènes → branches → fins, le sauvegarde et revient le modifier.
2. Le player navigue le graphe, affiche l'overlay de choix aux nœuds `branch`, et sauvegarde la progression en localStorage.
3. "Tester" depuis le canvas lance le player avec le graphe courant, scènes vides comprises.
4. La publication génère un ZIP avec `graph.json` embarqué, lisible hors ligne.
5. Le script `reset_db.py` supprime proprement les données existantes avant la migration.
