# Sprint 0 — Prototype lecteur vidéo (version PWA)

## ⚠️ Toujours la même limite honnête

Je n'ai pas pu exécuter ce prototype moi-même (pas de navigateur, pas d'appareil réel dans mon
environnement). Le code est prêt et fonctionnel en théorie, mais **c'est à toi de l'ouvrir
réellement sur chaque appareil** et de remplir `TEST_PROTOCOL.md` avec de vraies observations.

## Ce que contient ce dossier

- `index.html` — la page de l'app
- `app.js` — toute la logique du lecteur (charge, play/pause, seek, plage, reprise, erreurs)
- `styles.css` — mise en forme
- `manifest.json` — rend l'app installable ("Ajouter à l'écran d'accueil")
- `service-worker.js` — nécessaire techniquement pour l'installabilité
- `icons/icon.svg` — icône de l'app une fois installée
- `TEST_PROTOCOL.md` — le rapport à remplir avec de vrais tests

## Pourquoi c'est plus simple que la version Flutter

Un seul code, qui tourne tel quel dans le navigateur de chaque plateforme (Safari sur
iPhone/iPad/Mac, Chrome sur Android, Edge/Chrome sur Windows). Pas de compilation native, pas de
Xcode, pas de simulateur, pas d'implémentation séparée pour Windows.

Voir `TUTORIEL_PWA.md` (fourni à côté) pour la marche à suivre complète, étape par étape.
