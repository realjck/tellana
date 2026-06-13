# Modale de paramètres d'embranchement — Design

Date : 2026-06-13
Branche : `feat/tel-24`
Corrige : bug #2 du code review TEL-24 (tous les choix s'affichent « Choix 1 », `order` toujours 0, aucun label éditable).

## Problème

Dans l'implémentation actuelle :
- `onConnect` crée chaque edge sortant d'un branch avec `order: 0` et `label: null`.
- Aucune UI ne permet d'éditer le label d'un choix.
- `BranchOverlay` rend `edge.label ?? \`Choix ${edge.order + 1}\``, donc **tous les choix d'un branch affichent « Choix 1 »** et leur ordre est indéterminé.

Les embranchements sont donc inexploitables.

## Objectif

Permettre à l'auteur de **définir les choix d'un embranchement dans une modale** (ouverte au double-clic sur le nœud branch), le **raccordement** de chaque choix à la scène/au nœud suivant restant dans l'éditeur Canvas.

## Décision d'architecture

Le **choix devient une propriété du nœud branch** (et non de l'edge), car un choix existe avant d'être raccordé (un edge exige une cible).

- Le nœud branch porte ses choix dans `data.choices = [{ id, label }, …]`.
  - `id` : identifiant stable généré à la création du choix (`crypto.randomUUID()`). Sert d'identité du choix indépendamment de l'ordre.
  - `label` : texte affiché dans le player. Obligatoire.
- L'ordre des choix = l'ordre du tableau `choices`.
- Chaque edge sortant d'un branch enregistre `source_handle = choice.id` → on sait quel choix mène vers quelle cible, y compris après rechargement ou réordonnancement.

Cela nécessite une colonne `source_handle` (string, nullable) sur `graph_edges` (ajout additif).

## Données

### `data` d'un nœud branch

```ts
{
  title: string;                      // ex. "Embranchement 1"
  show_visited: boolean;              // défaut true
  choices: { id: string; label: string }[];  // 2 à 5 éléments, ordre = ordre des choix
}
```

À la création d'un branch (`createNode`) :
- `title` auto-numéroté : `Embranchement ${nbBranchesExistants + 1}`.
- `show_visited: true`.
- `choices`: 2 choix par défaut, labels `Choix 1`, `Choix 2`.

### `GraphEdge`

Ajout du champ `source_handle: string | null` (= `choice.id` du choix d'origine, `null` pour les edges non-branch).

## Backend

- **`models.py`** : `GraphEdge.source_handle = Column(String, nullable=True)`.
- **`main.py`** : migration safe `ALTER TABLE graph_edges ADD COLUMN source_handle ...` dans un `try/except` (convention projet ; `create_all` couvre les DB fraîches).
- **`schemas.py`** : `source_handle: Optional[str] = None` sur `GraphEdge` et `GraphEdgeCreate`.
- **`routers/graph.py`** : `create_graph_edge` enregistre `source_handle`. La contrainte « branch ≤ 5 edges sortants » est conservée.

Pas de nouvel endpoint : les labels/ordre/titre/show_visited sont stockés dans `data` du nœud et persistés via le `PATCH /graph/nodes/{id}` existant.

## Frontend — édition (Canvas)

### `components/BranchSettingsModal.tsx` (nouveau)

Style aligné sur `ConfirmModal` (overlay `fixed inset-0`, carte `bg-elevated`, fermeture sur Échap / clic backdrop).

Contenu :
- **Titre** de l'embranchement (input texte).
- **Liste ordonnée des choix** : pour chaque choix, un input label (requis) + boutons ▲/▼ (réordonner) + bouton supprimer (désactivé quand il ne reste que 2 choix).
- **Bouton « Ajouter un choix »** (désactivé à 5 choix ; nouveau choix labellisé `Choix N` par défaut).
- **Case « Afficher les liens déjà visités »** (`show_visited`).
- Boutons **Annuler** / **Enregistrer**.

Validation : un label vide est rétabli au défaut `Choix N` (label jamais vide). À l'enregistrement, la modale renvoie le nouvel objet `data` au canvas via un callback `onSave(data)`.

### `components/canvas/BranchNode.tsx`

- **Suppression** du renommage inline du titre. Le titre est affiché en lecture seule.
- Rend **N handles source** (un par `choice`, 2 à 5), `id = choice.id`, répartis horizontalement (`left = (i+1)/(N+1)*100%`), avec un petit label sous chaque handle.
- Le double-clic n'est pas géré ici : il est capté au niveau du canvas (`onNodeDoubleClick`).

### `app/stories/[id]/canvas/page.tsx`

- **État** : `branchModalNodeId: number | null`.
- **`handleNodeDoubleClick`** : si `node.type === "branch"`, ouvre la modale pour ce nœud (au lieu de l'éventuelle navigation scène).
- **`createNode("branch")`** : `data = { title: \`Embranchement ${branchCount + 1}\`, show_visited: true, choices: [{id, label:"Choix 1"}, {id, label:"Choix 2"}] }` où `branchCount = nodes.filter(n => n.type === "branch").length`.
- **`onConnect`** : transmet `source_handle: params.sourceHandle ?? null` (fin du `order: 0` codé en dur).
- **`toFlowEdge`** : réémet `sourceHandle: e.source_handle ?? undefined` pour réattacher l'edge au bon handle après rechargement.
- **`toFlowNode`** (branch) : passe `title`, `show_visited`, `choices` dans `data` pour le rendu des handles.
- **Sauvegarde de la modale** (`handleBranchSave`) : `PATCH` data du nœud, mise à jour du nœud local, puis **suppression des edges dont le `source_handle` ne correspond plus à un `choice.id` existant** (suppression DB via `api.graph.deleteEdge` + retrait de l'état `edges`).

## Frontend — lecture (Player)

### `components/GraphPlayer.tsx`

Pour un nœud branch :
- Lit `currentNode.data.choices` (ordre = ordre des choix).
- Pour chaque choix, recherche l'edge tel que `source_node_id === branch.id && source_handle === choice.id`.
- Construit `options = choices` raccordés uniquement → `{ edgeId, targetNodeId, label, visited }`.
  - Les choix non raccordés (aucun edge) sont ignorés (ils ne mènent nulle part).
  - `visited` calculé seulement si `show_visited !== false`.
- Passe `options` et `onChoice` à `BranchOverlay`.

### `components/BranchOverlay.tsx`

- Props remplacées par : `options: { edgeId: number; targetNodeId: number; label: string; visited: boolean }[]` et `onChoice: (edgeId, targetNodeId) => void`.
- Rend un bouton par option avec son `label` (fin du fallback `Choix ${order+1}`), classe `player-branch-option-visited` si `visited`.

## Types

`types/index.ts` :
- `GraphNodeData` : `choices?: { id: string; label: string }[]`, `show_visited?: boolean` (déjà présent), `title?: string | null` (déjà présent).
- `GraphEdge` : `source_handle?: string | null`.

`lib/api.ts` : `createEdge` accepte `source_handle?: string | null`.

## Tests

- **Backend** (`tests/test_graph.py`) : création d'edge avec `source_handle`, présent dans `GET /graph`.
- **Frontend** :
  - `BranchOverlay.test.tsx` : adapté à la prop `options` ; vérifie l'affichage des labels et la classe visited.
  - `GraphPlayer.test.tsx` : adapté ; branch lit `choices`, mappe via `source_handle`, ignore les choix non raccordés.
  - `BranchSettingsModal.test.tsx` (nouveau) : ajout/suppression bornés (2–5), réordonnancement, label vide rétabli au défaut, `onSave` renvoie le bon `data`.

## Hors périmètre

- Les autres findings du code review (#1 ignoré — pas de stories existantes ; #3, #4, #5, #6, #7, #8 traités séparément).
- L'option `replay` : non incluse (non demandée).
