# Protocole de test Sprint 0 (version PWA)

À exécuter réellement, sur chaque navigateur/appareil. Ne remplis une case qu'après avoir vraiment
observé le comportement.

## Matrice à remplir (PASS / PASS_WITH_LIMITATIONS / FAIL)

| Fonction | Safari iOS | Chrome Android | Safari macOS | Chrome/Edge Windows | Notes |
|---|---|---|---|---|---|
| Chargement YouTube (video_id valide) | | | | | |
| Lecture (play) | | | | | |
| Pause | | | | | |
| Reprise après pause | | | | | |
| Seek vers un timecode précis | | | | | |
| Plusieurs seeks successifs | | | | | |
| Lecture d'une plage (arrêt auto ±0.5s) | | | | | |
| Reprise de position (sans autoplay) | | | | | |
| Changement de vidéo A→B sans recharger la page | | | | | |
| Recréation du lecteur (≥10 cycles) | | | | | |
| video_id invalide → message clair | | | | | |
| Installation "Ajouter à l'écran d'accueil" | | | | | |
| Lancement depuis l'icône installée (mode standalone) | | | | | |
| Stabilité générale (pas de gel/plantage) | | | | | |

## Ce qui change par rapport à la version Flutter native

- Plus de colonne "Windows spécifique" : le même code (API IFrame YouTube officielle) tourne dans
  Edge/Chrome sur Windows comme partout ailleurs. C'était le principal risque technique identifié —
  la PWA le supprime par construction.
- Nouveau point à vérifier en plus : l'**installation** elle-même (ajout à l'écran d'accueil) sur
  chaque plateforme, qui a ses propres spécificités d'interface.

## Test critique (identique à avant)

1. Charger une vidéo
2. Seek à 84s → vérifier l'arrivée précise à 01:24
3. Début=84, Fin=102 → "Lire la plage" → doit s'arrêter entre 01:41.5 et 01:42.5

## Décision finale (à écrire après exécution réelle)

```
SPRINT 0 RESULT = GO | NO_GO
```

(Plus de variante "GO_WITH_WINDOWS_ADAPTATION" — en PWA il n'y a qu'une seule implémentation à
valider, pas une déclinaison spécifique par plateforme.)
