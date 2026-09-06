# Tutoriel — Tester le prototype PWA (bien plus simple que la version Flutter)

Ce tutoriel part du principe que tu n'as jamais fait ça. Deux parties :
1. Tester rapidement sur ton Mac (5 minutes, zéro installation)
2. Obtenir une vraie adresse web pour tester sur ton iPhone, un Android, un PC Windows (10 minutes)

---

## Partie A — Tester sur ton Mac

### 1. Récupère le projet

Télécharge le fichier `sprint0-pwa.zip` que je t'ai fourni, double-clique dessus pour le
décompresser. Tu obtiens un dossier `sprint0-pwa`.

### 2. Ouvre le Terminal

`Cmd + Espace`, tape `Terminal`, appuie sur `Entrée`.

### 3. Va dans le dossier du projet

Tape `cd ` (avec un espace après), puis **glisse le dossier `sprint0-pwa` depuis le Finder
directement dans la fenêtre du Terminal** — le chemin se remplit tout seul. Appuie sur `Entrée`.

### 4. Lance un petit serveur local

macOS a déjà tout ce qu'il faut installé. Tape simplement :

```bash
python3 -m http.server 8000
```

Tu devrais voir s'afficher quelque chose comme `Serving HTTP on :: port 8000`. **Laisse cette
fenêtre de Terminal ouverte** (c'est ton petit serveur qui tourne).

### 5. Ouvre l'app dans Safari

Ouvre Safari, va à l'adresse :

```
http://localhost:8000
```

L'app doit s'afficher. Teste le chargement d'une vidéo, play/pause, seek, lecture de plage, etc.
— suis les lignes de `TEST_PROTOCOL.md` pour la colonne "Safari macOS".

**Pour arrêter le serveur** quand tu as fini : retourne dans le Terminal, appuie sur `Ctrl + C`.

---

## Partie B — Obtenir une vraie adresse web (pour tester sur iPhone, Android, Windows)

`localhost` ne fonctionne que sur ton propre Mac. Pour tester sur d'autres appareils, il faut mettre
le site en ligne. On va utiliser **Netlify Drop**, un service gratuit qui met un dossier en ligne en
quelques secondes, sans compte ni installation.

### 1. Va sur le site

Ouvre cette adresse dans ton navigateur :

```
https://app.netlify.com/drop
```

### 2. Dépose le dossier

**Glisse le dossier `sprint0-pwa`** (celui que tu as décompressé) directement sur la page. Attends
quelques secondes.

### 3. Récupère l'adresse

Une adresse du type `https://un-nom-aleatoire.netlify.app` apparaît. **C'est cette adresse que tu
vas ouvrir sur tes autres appareils** (iPhone, Android, PC Windows) — dans leur navigateur, comme
n'importe quel site.

> 💡 Cette adresse est utilisable immédiatement par n'importe qui la connaît, tant que tu ne
> supprimes pas le site. Pas besoin de créer de compte pour ce test rapide.

---

## Partie C — Tester sur chaque appareil

### iPhone / iPad (Safari)

1. Ouvre l'adresse `https://....netlify.app` dans **Safari** (important : pas Chrome, l'installation
   PWA sur iOS ne fonctionne qu'avec Safari)
2. Teste toutes les fonctions du lecteur (colonne "Safari iOS" du `TEST_PROTOCOL.md`)
3. Pour l'installer : appuie sur l'icône **Partager** (le carré avec la flèche vers le haut, en bas
   de l'écran) → fais défiler → **"Sur l'écran d'accueil"** → **Ajouter**
4. Une icône apparaît sur ton écran d'accueil, comme une vraie app. Ouvre-la depuis là pour tester
   le mode "standalone" (sans barre d'adresse Safari visible)

### Android (Chrome)

1. Ouvre l'adresse dans Chrome
2. Teste toutes les fonctions
3. Une bannière "Installer l'application" apparaît généralement automatiquement en bas — sinon,
   menu `⋮` (trois points en haut à droite) → **"Installer l'application"**

### PC Windows (Edge ou Chrome)

1. Ouvre l'adresse
2. Teste toutes les fonctions
3. Une icône d'installation (petit écran avec une flèche) apparaît dans la barre d'adresse, à droite
   → clique dessus → **Installer**

---

## Partie D — Remplir le rapport

Ouvre `TEST_PROTOCOL.md` (avec TextEdit par exemple) et coche `PASS`, `PASS_WITH_LIMITATIONS` ou
`FAIL` pour chaque ligne, au fur et à mesure de tes tests réels sur chaque appareil.

---

## En cas de souci

Colle-moi le message d'erreur exact (dans le Terminal, ou ce qui s'affiche à l'écran) et je te dirai
quoi faire précisément.
