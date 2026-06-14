---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Nouvelle feature Tellana — expérience joueur et gestion des assets'
session_goals: 'Features UX, amélioration du player, gestion des assets'
selected_approach: 'random-selection'
techniques_used: ['Alien Anthropologist', 'What If Scenarios', 'SCAMPER Method']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitateur:** jck
**Date:** 2026-06-14

## Session Overview

**Topic:** Nouvelle feature Tellana — expérience joueur et gestion des assets
**Goals:** Features UX, amélioration du player, gestion des assets

## Technique Selection

**Approche :** Sélection aléatoire (sérendipité)

**Techniques sélectionnées :**
- **Alien Anthropologist** : Observer Tellana avec des yeux totalement étrangers pour révéler les hypothèses cachées
- **What If Scenarios** : Explorer des possibilités radicales sans contraintes
- **SCAMPER Method** : Transformer les idées en features concrètes via 7 prismes

---

## Idées générées

### Thème A — Navigation joueur

**[UX #1]** : Journal de navigation / Table des chapitres
_Concept :_ Un panneau accessible depuis le player qui liste toutes les scènes/chapitres déjà traversés, avec possibilité de cliquer pour y revenir directement.
_Novelty :_ Transforme le player linéaire en espace non-linéaire maîtrisé par le joueur.

**[UX #2]** : Historique des choix visités
_Concept :_ Une timeline visuelle des nœuds branch traversés, avec le choix effectué mis en évidence — accessible depuis un bouton discret dans le player.
_Novelty :_ Le joueur visualise son "chemin narratif" et peut sauter à n'importe quel carrefour passé en un clic.

**[UX #3]** : Arbre de progression persistant
_Concept :_ Une seule save qui accumule tous les chemins explorés — `visitedEdgeIds` ne se réinitialise jamais, même en revenant en arrière. Le joueur voit l'arbre narratif se "colorier" progressivement.
_Novelty :_ La progression devient une collection d'expériences, pas un simple curseur linéaire.

**[UX #4]** : Contrôle auteur sur la visibilité de l'arbre
_Concept :_ Paramètre par story — "révéler l'arbre au joueur" (oui/non/après complétion). L'auteur choisit si le joueur voit les branches non explorées.
_Novelty :_ La même feature sert des genres différents — mystery (tout caché) vs. visual novel exploratoire (tout visible).

**[UX #15]** : Taux de complétion joueur
_Concept :_ Indicateur visible "tu as exploré 3 fins sur 5", dérivé de `visitedEdgeIds` et du nombre de nœuds `end` dans le graphe.
_Novelty :_ Encourage la rejouabilité sans spoiler le contenu non découvert.

### Thème B — Médiathèque ⭐ PRIORITAIRE

**[Asset #5]** : Organisation sémantique des assets — dossiers racine
_Concept :_ Les assets sont organisés en dossiers logiques — `characters/`, `backgrounds/`, `audio/` — avec possibilité de créer des sous-dossiers. L'upload associe directement un asset à une catégorie.
_Novelty :_ L'éditeur devient une médiathèque structurée, pas un dépôt plat.

**[Asset #6]** : Sous-dossier par personnage
_Concept :_ Chaque personnage a son propre sous-dossier automatiquement créé (`characters/Elena/`) contenant toutes ses poses.
_Novelty :_ La structure de l'asset library reflète directement le casting — naviguer dans les assets, c'est naviguer dans les personnages.

**[Asset #8]** : Upload multi-fichiers pour les poses
_Concept :_ Dans `CharacterPosesManager`, permettre de sélectionner et uploader plusieurs fichiers en une opération. Chaque fichier devient une pose nommée d'après son nom de fichier.
_Novelty :_ Peupler un personnage avec toutes ses poses passe de 10 actions à 1.

**[Asset #9]** : Media Box CMS-style avec drag & drop ⭐ PRIORITAIRE
_Concept :_ Une page/panneau "Médiathèque" dédiée — navigation dossiers, grille de miniatures, drag & drop multi-fichiers, renommage inline. Les assets uploadés ici sont disponibles partout dans l'éditeur.
_Novelty :_ L'asset management devient un espace de travail de premier ordre, pas une fonctionnalité cachée dans les formulaires.

**[Asset #10]** : Substitution globale par remplacement de fichier
_Concept :_ Si un fichier uploadé a le même nom qu'un asset existant, un warning s'affiche puis le fichier est remplacé à la source. Toutes les scènes voient automatiquement la nouvelle version.
_Novelty :_ Itérer sur un asset passe de supprimer/re-linker partout à un simple re-upload.

### Thème C — Audio

**[Audio #11]** : Ambiance musicale par scène
_Concept :_ Chaque scène a un slot "musique de fond" — upload MP3/OGG, volume, loop. Le GraphPlayer joue la piste à l'entrée de la scène avec fondu enchaîné.
_Novelty :_ L'atmosphère émotionnelle d'une scène devient composable sans une ligne de code.

**[Audio #12]** : Sound FX systémiques
_Concept :_ Bibliothèque de sons d'interface configurables — clic "suivant", apparition d'un choix branch, transition de scène. L'auteur peut remplacer les sons par défaut.
_Novelty :_ Le feedback sonore renforce l'immersion et l'identité de chaque story.

### Thème D — Outils auteur

**[UX #14]** : Mini-player intégré dans le canvas
_Concept :_ Prévisualisation d'un SceneNode au survol ou double-clic directement dans le canvas, sans ouvrir le player séparé.
_Novelty :_ Le canvas devient interactif — voir et éditer dans le même espace.

**[UX #16]** : "Tester depuis ce nœud" sur le canvas
_Concept :_ Bouton sur chaque SceneNode du canvas pour lancer le player directement depuis ce nœud, sans rejouer depuis le début.
_Novelty :_ Réduit drastiquement le cycle edit → test pour les scènes au milieu du graphe.

---

## Organisation et priorités

### Feature prioritaire retenue

**Médiathèque structurée** (#5 + #9, avec #6, #8, #10 inclus naturellement)

**Périmètre :**
- Dossiers racine : `characters/`, `backgrounds/`, `audio/`
- Sous-dossier automatique par personnage
- Page/panneau "Médiathèque" : grille miniatures, drag & drop multi-fichiers, renommage inline
- Substitution par même nom de fichier avec warning

**Prochaines étapes :**
1. Backend — champ `folder` sur `Asset`, endpoint `GET /api/assets?folder=`, upload avec folder cible
2. Frontend — nouvelle page Médiathèque avec navigation dossiers + grille + zone drag & drop
3. Intégration — sélecteurs d'assets existants (fond, sprites) piochent dans la médiathèque

### Backlog futur
- Navigation joueur : #1, #2, #3, #4, #15 (post-médiathèque)
- Audio : #11, #12 (dépend du dossier `audio/` de la médiathèque)
- Outils auteur : #14, #16

---

## Résumé de session

**Techniques utilisées :** Alien Anthropologist → What If Scenarios → SCAMPER
**Ideas validées :** 13 idées réparties en 4 thèmes
**Feature décidée :** Médiathèque CMS-style structurée par dossiers
