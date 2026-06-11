# Modèles de données — Backend Tellana

> Généré le 2026-06-11 · Scan : quick (pattern-based, structure déduite de CLAUDE.md + noms de fichiers)

---

## Schéma global

```
Story ──< Scene ──< Node
  │
  └──< Character
```

---

## Entités

### Story

| Champ | Type | Description |
|-------|------|-------------|
| `id` | int PK | Identifiant auto |
| `title` | str | Titre éditable |
| `slug` | str unique | URL-safe (translittération accent → ASCII) |
| `published` | bool | Story publiée ou non |
| `published_at` | DateTime? | Horodatage dernière publication (nullable) |
| `updated_at` | DateTime | Dernière modification contenu |
| `scenes` | relation | Liste de `Scene` (ordonnées) |
| `characters` | relation | Liste de `Character` (partagés entre scènes) |

### Scene

Hérite de `SceneSummary`.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | int PK | |
| `story_id` | int FK | Référence Story |
| `title` | str | Titre de la scène |
| `order` | int | Position dans la story |
| `background` | AssetRef? | Décor (image de fond) |
| `character_ids` | list[int] | IDs persos visibles (max 4, ordonnés, dernier = avant-plan) |
| `character_positions` | Dict[str, CharacterPosition] | Position par personnage (clé = str(id)) |
| `nodes` | relation | Liste de `Node` (ordonnés) |

### Node

| Champ | Type | Description |
|-------|------|-------------|
| `id` | int PK | |
| `scene_id` | int FK | Référence Scene |
| `type` | Literal["dialogue","text","quiz"] | Type fixé à la création |
| `order` | int | Position dans la scène |
| `data` | JSON / dict | Contenu spécifique au type |

**Contenu `data` par type :**

- `dialogue` : `{ character_id: int|null, text: str }`
- `text` : `{ content: str }` (Markdown)
- `quiz` : `{ question: str, options: list[str], correct_index: int }`

### Character

| Champ | Type | Description |
|-------|------|-------------|
| `id` | int PK | |
| `story_id` | int FK | Attaché à une story (partagé entre scènes) |
| `name` | str | Nom du personnage |
| `color` | str? | Couleur hex (ex. `#FF6B6B`), nullable |
| `sprites` | dict[str, AssetRef] | Poses : clé = nom de pose, valeur = AssetRef |

### Asset / AssetRef

| Champ | Type | Description |
|-------|------|-------------|
| `id` | int PK | |
| `filename` | str | Nom de fichier dans `uploads/` |
| `url` | str | URL relative `/uploads/{filename}` |
| `content_type` | str | MIME type (fourni par le client) |

`AssetRef` est une référence légère (`{ id, url }`) embarquée dans les autres entités.

---

## Type CharacterPosition

```typescript
{
  x: float      // [-1, 1]   position horizontale (0 = centre)
  y: float      // [-3, 1]   position verticale
  scale: float  // [0.1, 2.5] taille relative
  flip_x: bool  // miroir horizontal
}
```

---

## Migrations

Pattern safe au démarrage dans `main.py` :
```python
# Pour les colonnes ajoutées en cours de vie
try:
    ALTER TABLE ... ADD COLUMN ...
except:
    pass  # colonne déjà présente
```

`create_all()` gère les DB fraîches ; les blocs `ALTER TABLE` gèrent les DB existantes.

Colonnes ajoutées progressivement : `character_positions`, `color`, `published_at`.

---

## Règles de validation

- `character_ids` sur Scene : max 4, doivent appartenir à la story
- Suppression d'un personnage : nettoie `character_ids` et `character_positions` dans toutes les scènes
- Slug : `unicodedata.normalize("NFKD")` + encode ASCII pour translittérer les accents
- `exclude_unset=True` sur tous les PATCH pour n'écraser que les champs fournis
- Reorder : valide tous les IDs avant commit (HTTP 400 si ID inconnu)
