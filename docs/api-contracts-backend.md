# Contrats API — Backend Tellana

> Généré le 2026-06-11 · Scan : quick (déduit des noms de routeurs et de CLAUDE.md)

Base URL : `http://localhost:8000`  
Documentation interactive : `http://localhost:8000/docs` (Swagger UI)

---

## Stories — `/api/stories`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/stories` | Liste toutes les stories (avec `first_scene_character_ids`, `characters`) |
| POST | `/api/stories` | Crée une story |
| GET | `/api/stories/{id}` | Détail d'une story avec scènes |
| PATCH | `/api/stories/{id}` | Met à jour titre/slug (`exclude_unset=True`) |
| DELETE | `/api/stories/{id}` | Supprime la story |
| GET | `/api/stories/{id}/export-zip` | Génère et télécharge le ZIP standalone |
| POST | `/api/stories/{id}/publish` | Publie la story (génère ZIP → `published/{slug}/`) |
| POST | `/api/stories/{id}/unpublish` | Dépublie (supprime `published/{slug}/`) |

### StorySummary (liste)

```json
{
  "id": 1,
  "title": "Ma Story",
  "slug": "ma-story",
  "published": false,
  "published_at": null,
  "updated_at": "2026-06-01T10:00:00",
  "first_scene_character_ids": [1, 2],
  "first_scene_character_positions": { "1": { "x": -0.5, "y": 0, "scale": 1.0, "flip_x": false } },
  "characters": [...]
}
```

---

## Scènes — `/api/stories/{story_id}/scenes`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/stories/{id}/scenes` | Liste les scènes d'une story |
| POST | `/api/stories/{id}/scenes` | Crée une scène |
| GET | `/api/scenes/{id}` | Détail d'une scène avec nœuds |
| PATCH | `/api/scenes/{id}` | Met à jour titre, background, character_ids, character_positions |
| DELETE | `/api/scenes/{id}` | Supprime la scène |
| POST | `/api/stories/{id}/scenes/reorder` | Réordonne les scènes (body: `{ scene_ids: [int] }`) |

---

## Nœuds — `/api/scenes/{scene_id}/nodes`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/scenes/{id}/nodes` | Liste les nœuds d'une scène |
| POST | `/api/scenes/{id}/nodes` | Crée un nœud (type fixé) |
| PATCH | `/api/nodes/{id}` | Met à jour le contenu `data` |
| DELETE | `/api/nodes/{id}` | Supprime le nœud |
| POST | `/api/scenes/{id}/nodes/reorder` | Réordonne les nœuds |

---

## Personnages — `/api/stories/{story_id}/characters`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/stories/{id}/characters` | Liste les personnages d'une story |
| POST | `/api/stories/{id}/characters` | Crée un personnage |
| PATCH | `/api/characters/{id}` | Met à jour nom, color, sprites |
| DELETE | `/api/characters/{id}` | Supprime (nettoie character_ids dans toutes les scènes) |

---

## Assets — `/api/assets`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/assets` | Liste les assets uploadés |
| POST | `/api/assets/upload` | Upload un fichier (multipart/form-data) |
| DELETE | `/api/assets/{id}` | Supprime un asset |

### AssetRef (réponse upload)

```json
{
  "id": 42,
  "url": "/uploads/filename.png",
  "content_type": "image/png"
}
```

---

## Fichiers statiques

| Chemin | Description |
|--------|-------------|
| `/uploads/{filename}` | Assets uploadés (images, sprites) |
| `/published/{slug}/` | Story publiée (HTML standalone, servi via StaticFiles) |

---

## Codes d'erreur courants

| Code | Cas |
|------|-----|
| 404 | Ressource introuvable |
| 400 | Validation échouée (IDs inconnus, dépassement limite 4 personnages) |
| 422 | Validation Pydantic (corps invalide) |
