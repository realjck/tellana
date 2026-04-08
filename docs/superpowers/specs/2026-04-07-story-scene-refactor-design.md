# Design Spec — Refonte Story/Scene (Prototype V2)

**Ticket correspondant :** TEL-8

**Date :** 2026-04-07  
**EPIC Jira :** TEL-5 (Prototype V2)  
**Statut :** Approuvé

---

## Contexte

Dans le prototype V1, l'objet `Story` représentait une séquence de nœuds (dialogues, textes, quiz) avec un décor et des personnages. Pour V2, on introduit une hiérarchie à deux niveaux :

- **Story** (nouveau parent) : titre, slug, publication, personnages
- **Scene** (renommé depuis Story) : séquence de nœuds avec son propre décor et titre, ordonnée au sein d'une story

Une story = plusieurs scènes jouées en séquence par le visiteur.

---

## Décisions de conception

| Sujet | Décision |
|---|---|
| Personnages | Attachés à la Story (partagés entre toutes les scènes) |
| Publication / slug | Au niveau Story uniquement |
| Navigation éditeur | Deux étapes : page Story → page Scene editor |
| Migration données | Reset complet (drop/recreate) |
| Champ `position` sur `characters` | **Supprimé** — le ScenePlayer positionne dynamiquement |

---

## Modèle de données

### Table `stories` (nouveau parent)
```
id           INTEGER PK
title        STRING NOT NULL
slug         STRING UNIQUE NOT NULL
published    BOOLEAN DEFAULT false
created_at   DATETIME
updated_at   DATETIME
```
Relations : `scenes[]` (cascade delete), `characters[]` (cascade delete)

### Table `scenes` (renommé depuis `stories`)
```
id             INTEGER PK
story_id       INTEGER FK → stories.id
title          STRING NOT NULL
order          INTEGER NOT NULL
background_url STRING NULL
created_at     DATETIME
updated_at     DATETIME
```
Relations : `nodes[]` (cascade delete)

### Table `characters`
```
id         INTEGER PK
story_id   INTEGER FK → stories.id   ← pointe vers le nouveau parent
name       STRING NOT NULL
image_url  STRING NOT NULL
           (position supprimé)
```

### Table `nodes`
```
id        INTEGER PK
scene_id  INTEGER FK → scenes.id     ← renommé depuis story_id
order     INTEGER NOT NULL
type      STRING NOT NULL  ("dialogue"|"text"|"quiz")
data      JSON NOT NULL
```

---

## API Routes

### Stories
```
GET    /api/stories/                 → liste StorySummary[]
POST   /api/stories/                 → créer { title }
GET    /api/stories/{id}             → Story + scenes (sans nodes)
PATCH  /api/stories/{id}             → modifier title / published
DELETE /api/stories/{id}             → cascade sur scenes, characters, nodes
GET    /api/stories/by-slug/{slug}   → lecture publique (published=true) + scenes avec nodes
```

### Scenes
```
GET    /api/stories/{id}/scenes/                  → Scene[]
POST   /api/stories/{id}/scenes/                  → créer { title }
GET    /api/stories/{id}/scenes/{sid}             → Scene + nodes
PATCH  /api/stories/{id}/scenes/{sid}             → modifier title / background_url
DELETE /api/stories/{id}/scenes/{sid}             → cascade nodes
POST   /api/stories/{id}/scenes/reorder           → { order: int[] }
```

### Characters (attachés à la story)
```
POST   /api/stories/{id}/characters/
PATCH  /api/stories/{id}/characters/{cid}
DELETE /api/stories/{id}/characters/{cid}
```

### Nodes (attachés à la scène)
```
POST   /api/stories/{id}/scenes/{sid}/nodes/
PATCH  /api/stories/{id}/scenes/{sid}/nodes/{nid}
DELETE /api/stories/{id}/scenes/{sid}/nodes/{nid}
POST   /api/stories/{id}/scenes/{sid}/nodes/reorder
```

---

## Frontend — Routes et composants

### Routes Next.js
```
/                                         Dashboard : liste des stories
/stories/[id]                             Story editor (titre, perso, scènes, publication)
/stories/[id]/scenes/[sceneId]/edit       Scene editor (background, nodes)
/stories/[id]/scenes/[sceneId]/play       Preview scène
/s/[slug]                                 Page publique multi-scènes
```

### Flux UX
1. **Dashboard** → liste des stories → "Créer une story" → POST → redirect `/stories/[id]`
2. **Story editor** (`/stories/[id]`) :
   - Header : titre éditable inline, bouton Prévisualiser, bouton Publier/Dépublier, lien copier URL publique
   - Sidebar gauche : `CharacterManager` (personnages de la story) - Nous ferons évoluer plus tard avec le choix des expressions (NB: Chaque avatar aura plusieurs sprites d'expressions)
   - Zone principale : liste des scènes ordonnables (▲▼), carte par scène avec titre + preview background, bouton "+ Nouvelle scène", bouton "Éditer" → `/stories/[id]/scenes/[sceneId]/edit`
3. **Scene editor** (`/stories/[id]/scenes/[sceneId]/edit`) : l'éditeur actuel adapté (tabs Nœuds / Décor), personnages chargés depuis la story parente
4. **Page publique** (`/s/[slug]`) : charge la story + toutes les scènes avec leurs nodes, les joue en séquence dans `ScenePlayer`

### Composants à créer / modifier
| Fichier | Action |
|---|---|
| `app/page.tsx` | Refactor léger : wording Story → Story (inchangé côté user) |
| `app/stories/[id]/page.tsx` | **Nouveau** : Story editor |
| `app/stories/[id]/scenes/[sceneId]/edit/page.tsx` | Renommage + adaptation depuis `app/stories/[id]/edit/page.tsx` |
| `app/stories/[id]/scenes/[sceneId]/play/page.tsx` | Renommage depuis `app/stories/[id]/play/page.tsx` |
| `app/s/[slug]/page.tsx` | Adapter pour charger N scènes et les jouer en séquence |
| `components/ScenePlayer.tsx` | Adapter pour multi-scènes (prop `scenes[]` optionnelle) |
| `lib/api.ts` | Refactorer tous les appels (stories + scenes + characters + nodes) |
| `types/index.ts` | Renommer `Story` → `Scene`, nouveau type `Story`, `StorySummary` |

---

## Backend — Fichiers à modifier

| Fichier | Action |
|---|---|
| `models.py` | Nouveau modèle `Story`, renommer `Story` → `Scene`, adapter `Character` (supprimer `position`), adapter `Node` (`scene_id`) |
| `schemas.py` | Nouveaux schémas `Story*`, renommer `Story*` → `Scene*`, adapter `Character` (supprimer `position`) |
| `routers/stories.py` | Refactorer pour le nouveau modèle Story |
| `routers/scenes.py` | **Nouveau** : CRUD + reorder des scènes |
| `routers/characters.py` | Adapter FK et supprimer `position` |
| `routers/nodes.py` | Adapter pour `scene_id` |
| `main.py` | Enregistrer le nouveau router `scenes` |
| `tests/` | Réécrire tous les tests |

---

## Hors scope (prototype)

- Pas de drag-and-drop pour réordonner les scènes (▲▼ suffisent)
- Pas de migration de données (reset complet)
