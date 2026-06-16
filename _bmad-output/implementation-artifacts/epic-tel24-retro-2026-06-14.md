# Rétrospective — Epic TEL-24 : Embranchements narratifs
**Date :** 2026-06-14  
**Participants :** jck (Project Lead), Amelia (Developer), John (PM), Winston (Architect), Mary (Business Analyst)

---

## Résumé de l'epic

| Métrique | Valeur |
|----------|--------|
| Stories livrées | 3/3 (TEL-25, TEL-26, TEL-27) |
| Commits totaux | 32 (3 big-bang initiaux + 29 fixes/améliorations) |
| PR GitHub | #20 — mergée sur main |
| Couverture FR | 100% (FR-1.x à FR-4.x) |
| Première rétro du projet | Oui |

---

## Ce qui a bien marché

- **Processus amont (phases 1–2)** : le brainstorming et la rédaction du PRD ont bien fonctionné. La vision produit était claire, les fonctionnalités bien définies.
- **Qualité du résultat final** : malgré les corrections post-implémentation, le code livré est propre, documenté, et la PR mergée sans dette majeure.
- **Corrections méthodiques** : les 29 commits post-big-bang ont été traités un à un, avec identification claire de la root cause avant chaque fix.

---

## Ce qui n'a pas marché

### 1. PRD insuffisamment relu avant l'implémentation
Le PRD décrivait les fonctionnalités (le QUOI) mais pas les contrats de données (le COMMENT). Le mécanisme `source_handle` — lien entre un choix sur un nœud branch et une arête du graphe — n'était pas formalisé. Découvert en cours d'implémentation, il a nécessité un pivot architectural.

### 2. Étape architecture sautée
`bmad-create-architecture` n'a pas été exécuté. Les schémas de données, relations entre entités (GraphNode, GraphEdge, choices[], source_handle) et contrats d'API n'ont pas été posés avant le dev. Plusieurs incohérences auraient été détectées à ce stade.

### 3. Stories trop grandes (approche big-bang)
Les 3 stories (TEL-25, TEL-26, TEL-27) ont chacune couvert une couche entière en un seul commit. Cela concentre les risques et repousse la détection des frictions d'intégration après la livraison.

### 4. Pas de cycle Code Review structuré
Les dysfonctionnements ont été détectés à l'usage plutôt qu'en revue de code formelle. Résultat : cascade de 20+ fixes post-merge.

---

## Découvertes techniques clés

| Problème | Root cause | Résolution |
|----------|-----------|------------|
| Fullscreen quitte sur navigation branch/end | ScenePlayer était l'élément fullscreen — il démontait à chaque changement de nœud | Fullscreen levé au niveau GraphPlayer (persistent container) |
| source_handle manquant | PRD prévoyait `label` sur edges — insuffisant pour lier un choix à une arête | Ajout de `choices[]` sur BranchNode + `source_handle` sur GraphEdge |
| Écrans branch/end hors scale 1920×1080 | GraphPlayer ne suivait pas la mécanique ScenePlayer | Composant `ScaledScreen` (mirror de ScenePlayer) |
| cursor-pointer absent dans le bundle standalone | Tailwind utility écrasée par reset `cursor: default` des `<button>` dans le IIFE | `cursor: pointer` ajouté directement dans `.player-next-btn` (player.css) |
| Cadre sélection overlay au mauvais endroit | `SceneCharacterEditorOverlay` utilisait `{x:0, y:0}` comme fallback au lieu de `DEFAULT_POSITIONS[slotIndex]` | Alignement sur la même logique que `ScenePlayer.getCharPosition` |

---

## Action items

| # | Action | Propriétaire | Critère de succès |
|---|--------|-------------|-------------------|
| 1 | Relire le PRD en mode critique avant solutioning — annoter chaque FR avec le contrat de données attendu, identifier les trous de spec | jck | Chaque FR a un schéma ou un invariant associé avant de passer à l'architecture |
| 2 | Exécuter `bmad-create-architecture` avant tout dev | jck | Document d'architecture validé avec schémas, endpoints, flux d'intégration |
| 3 | Stories fines via `bmad-create-story` + `bmad-dev-story` — cycle create → validate → dev → review | jck | Chaque story = un périmètre limité, pas de big-bang commit |
| 4 | `bmad-code-review` (CR) après chaque story | jck | Revue structurée avant merge, corrections en amont plutôt qu'en cascade |

---

## Prochain epic

Pas encore défini. Brainstorming lancé en session suivante (`bmad-brainstorming`) pour identifier le thème du prochain epic. TEL-28 (IA générative) était mentionné comme piste hors scope TEL-24.

---

## Verdict

Epic TEL-24 **livré avec succès** sur tous les critères fonctionnels. Le principal enseignement est méthodologique : la phase 3-solutioning (architecture + stories fines) doit être respectée pour éviter les pivots et corrections en cascade. La fondation produit et technique est saine pour la suite.
