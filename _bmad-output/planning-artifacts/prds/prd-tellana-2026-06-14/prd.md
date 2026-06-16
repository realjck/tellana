---
title: "PRD — Médiathèque structurée (Tellana)"
status: draft
created: 2026-06-14
updated: 2026-06-14
---

# PRD — Médiathèque structurée

## Contexte et objectif

Tellana dispose actuellement d'un système d'upload d'assets fonctionnel mais non structuré : les images sont stockées dans un dossier `uploads/` plat, sans organisation sémantique, et leur gestion est dispersée dans les formulaires de personnage et de scène. Cela génère une friction croissante à mesure que le nombre d'assets augmente.

Cette feature introduit une **médiathèque globale** — partagée entre toutes les stories d'un utilisateur — avec une organisation en dossiers sémantiques, une interface CMS-style accessible depuis toute l'application, et un flux d'import de personnage simplifié.

**Non-objectifs (v1) :** gestion multi-utilisateurs, permissions d'assets, versioning d'assets, édition d'images in-app, recherche full-text dans les assets.

---

## Utilisateurs cibles

**Auteur de visual novel** (utilisateur unique, prototype) — crée et gère des stories, des personnages et des décors. Travaille seul, familier des CMS web (WordPress, Joomla).

---

## Fonctionnalités

### F1 — Structure de dossiers globale

Les assets sont organisés en dossiers sémantiques partagés entre toutes les stories.

**FR-1.1** Le backend ajoute un champ `folder: str` au modèle `Asset` (ex. `characters/Alice`, `backgrounds`, `audio`). Migration safe via `ALTER TABLE ... ADD COLUMN folder TEXT DEFAULT 'backgrounds'`.

**FR-1.2** Les dossiers racine prédéfinis sont : `characters/`, `backgrounds/`, `audio/`. L'utilisateur peut créer des sous-dossiers librement à n'importe quel niveau sous ces racines (ex. `backgrounds/intérieur`, `characters/alice-v2`).

**FR-1.3** Les assets peuvent être placés à n'importe quel niveau de l'arborescence — directement à la racine d'un dossier (`characters/alice.png`) ou dans un sous-dossier (`characters/alice/default.png`). Le nom du dossier est libre et indépendant du nom des personnages dans les stories.

**FR-1.4** Les endpoints de listing d'assets acceptent un paramètre `?folder=` pour filtrer par dossier. `GET /api/assets?folder=backgrounds` retourne tous les assets du dossier `backgrounds`.

**FR-1.5** L'endpoint d'upload `POST /api/assets` accepte un champ `folder` en multipart. Si absent, le dossier par défaut est `backgrounds`.

---

### F2 — Interface Médiathèque (modale)

Une modale globale "Médiathèque" accessible depuis l'ensemble de l'application.

**FR-2.1** La médiathèque s'ouvre dans une modale pleine-largeur (ou très large) depuis :
- Le bouton "Médiathèque" dans la navbar principale (page d'accueil et page story).
- Les sélecteurs d'assets existants (fond de scène, sprites) — en remplacement ou en complément du bouton d'upload direct. [ASSUMPTION : les sélecteurs actuels conservent leur flux mais ajoutent un bouton "Choisir depuis la médiathèque".]

**FR-2.2** La modale affiche un panneau de navigation de dossiers à gauche (arborescence : `characters/`, `characters/Alice`, `characters/Bob`, `backgrounds/`, `audio/`) et une grille de miniatures à droite.

**FR-2.3** La grille de miniatures affiche : vignette image, nom de fichier tronqué, icône de type (image/audio). Les vignettes sont cliquables pour sélection (si la modale est ouverte en mode "sélecteur") ou pour afficher les détails.

**FR-2.4** La modale supporte deux modes d'ouverture :
- **Mode navigation** : ouvert depuis la navbar, sans sélection retournée. Permet upload, renommage, suppression.
- **Mode sélecteur** : ouvert depuis un champ asset, retourne l'asset sélectionné au parent.

**FR-2.5** Upload depuis la modale : zone de drag & drop visible dans le dossier courant. Supporte la sélection multiple de fichiers (multi-upload). Les fichiers uploadés apparaissent immédiatement dans la grille.

**FR-2.6** Renommage inline : double-clic sur le nom d'un asset → champ éditable. Valide à la perte de focus ou touche Entrée.

**FR-2.7** Suppression : bouton × ou menu contextuel sur chaque asset → `ConfirmModal` avant suppression. [ASSUMPTION : la suppression d'un asset utilisé dans des scènes affiche un warning mais reste permise — comportement actuel conservé.]

**FR-2.8** Substitution par même nom de fichier : si un fichier uploadé a exactement le même nom qu'un asset existant dans le même dossier, un `ConfirmModal` s'affiche — "Ce fichier remplacera `X` utilisé dans N références. Confirmer ?" — puis le fichier est remplacé à la source. Toutes les références existantes (`AssetRef`) pointent automatiquement vers le nouveau fichier sans modification.

---

### F3 — Assets de démonstration (seed)

**FR-3.1** Le projet embarque des assets de démonstration pour deux personnages : **Alice** et **Bob**, avec plusieurs poses chacun.

**FR-3.2** Les images de seed sont stockées dans `backend/seed_assets/` et copiées dans `uploads/` au démarrage si absentes (pas d'écrasement si déjà présentes).

**FR-3.3** Les assets de seed sont enregistrés en base avec leur dossier (`characters/alice`, `characters/bob`) au premier démarrage.

**FR-3.4** L'utilisateur peut supprimer les assets de seed depuis la médiathèque comme n'importe quel asset.

**FR-3.5** Les poses de chaque personnage de seed incluent au minimum : `default` (pose neutre) + 2 poses expressives. Les noms de fichiers suivent la convention `{nom-pose}.png` (ex. `default.png`, `happy.png`, `surprised.png`).

---

### F4 — Import de personnage depuis un dossier

Le flux de création/édition d'un personnage dans une story est simplifié : au lieu d'uploader les sprites un à un, l'auteur pointe vers un sous-dossier `characters/` et les poses sont mappées automatiquement.

**FR-4.1** Dans `CharacterBasicForm`, un bouton "Importer depuis la médiathèque" ouvre la modale en mode sélecteur-dossier : l'auteur navigue dans l'arborescence `characters/` et sélectionne un dossier (pas un fichier). Le lien entre le dossier choisi et le personnage est un choix explicite de l'auteur — il est totalement indépendant du nom du personnage dans la story. Deux personnages différents dans la même story peuvent importer depuis deux dossiers différents, y compris si leurs noms sont identiques.

**FR-4.2** À la sélection d'un dossier, tous les assets images du dossier (niveau direct uniquement, sans récursion) sont récupérés et mappés automatiquement en poses :
- L'asset nommé `default.*` devient la pose `"default"` (pose par défaut, non renommable).
- Les autres assets sont mappés avec leur nom de fichier sans extension comme clé de pose (ex. `happy.png` → pose `"happy"`).

**FR-4.3** L'import écrase les sprites existants du personnage après confirmation si des poses étaient déjà définies. [ASSUMPTION : confirmation requise uniquement si le personnage avait déjà des sprites.]

**FR-4.4** Après import, les poses sont éditables normalement dans `CharacterPosesManager` (ajout, renommage, suppression individuelle).

**FR-4.5** Le flux d'upload manuel des poses reste disponible dans `CharacterPosesManager` en complément de l'import par dossier.

---

## Modèle de données — changements

| Entité | Champ | Changement |
|--------|-------|------------|
| `Asset` | `folder: str` | Nouveau champ. Défaut `'backgrounds'`. Migration `ALTER TABLE`. |

Aucun autre changement de modèle. Les `AssetRef` embarqués dans `Character.sprites` et `Scene.background` continuent de fonctionner sans modification.

---

## Points d'accès UX

| Point d'entrée | Contexte | Mode modale |
|----------------|----------|-------------|
| Navbar principale — bouton "Médiathèque" | Page d'accueil | Navigation |
| Navbar story — bouton "Médiathèque" | Page story / éditeur scène | Navigation |
| Sélecteur de fond de scène | Éditeur scène | Sélecteur → `backgrounds/` |
| Sélecteur de sprite (NodeForm) | Éditeur nœud dialogue | Sélecteur → `characters/{id}/` |
| "Importer depuis la médiathèque" (CharacterBasicForm) | Gestion personnage | Sélecteur dossier → `characters/` |

---

## Critères d'acceptation clés

- L'utilisateur peut uploader 10 images en une seule opération drag & drop dans un dossier de la médiathèque.
- Les assets Alice et Bob sont présents et utilisables dès le premier lancement de l'application.
- L'import d'un dossier personnage mappe correctement `default.png` comme pose par défaut et les autres fichiers par leur nom.
- Le remplacement d'un asset par même nom de fichier propage sans action supplémentaire dans toutes les scènes et personnages qui le référencent.
- La médiathèque est accessible en moins de 2 clics depuis n'importe quel écran de l'éditeur.

---

## Questions ouvertes

| # | Question | Décision |
|---|----------|----------|
| OQ-1 | ~~Sous-dossiers libres en v1 ?~~ | **Résolu** : oui, sous-dossiers libres à tous niveaux sous les 3 racines. |
| OQ-2 | ~~Convention slug dossier personnage~~ | **Résolu** : le nom de dossier est libre, choisi par l'auteur, sans lien avec le nom du personnage. |
| OQ-3 | ~~Collision si deux personnages ont le même nom~~ | **Résolu** : pas de collision possible — le dossier source est choisi explicitement par l'auteur lors de l'import, indépendamment du nom du personnage dans la story. |
