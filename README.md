# Générateur de banques d’oscillogrammes

Outil pédagogique hors ligne produisant en lot des oscillogrammes et des banques de questions Moodle.

## Production par défaut

- 50 sinus **Easy**, 100 **Medium** et 50 **Hard** ;
- aucun triangle ni carré, sauf si vous renseignez leurs quantités ;
- des images WebP de 900 px de large ;
- un fichier `inventaire.csv` avec les valeurs calculées et les calibres ;
- un fichier `corrige.csv` avec les quatre réponses de chaque signal ;
- une banque Moodle XML par type de signal et niveau sélectionné, avec les WebP intégrés et des réponses numériques ;
- une archive ZIP unique contenant les WebP, les CSV et les banques Moodle ; les PNG de 900 px sont facultatifs.

Les quantités restent modifiables dans l’interface.

## Types de signaux et niveaux

- **Sinus et triangles** : quatre réponses `Umax`, `Umoy`, `T`, `f`. En Easy, divisions entières et `Umoy = 0` ; en Medium, demi-divisions et décalage simple possible ; en Hard, graduations d’un cinquième de division et `Umoy` non nulle.
- **Carrés** : quatre réponses `Umax`, `T`, `f`, `D`, avec `D = Th/T × 100` en pourcentage. Les plateaux sont toujours symétriques autour de l’axe central (`+Umax` et `−Umax`), même si `D ≠ 50 %`. `Umoy` n’est pas demandée ni exportée. En Easy, `D = 50 %` ; en Medium, `D` vaut 25, 50 ou 75 % ; en Hard, 20, 40, 60 ou 80 %, avec des lectures au cinquième de division.

Tous les signaux sont maintenus entièrement visibles.
Le début de chaque période est aligné sur la première ligne verticale du quadrillage utile, et non sur le bord physique de l’écran : passage montant par la valeur moyenne pour les sinus et triangles, front montant pour les carrés. La période occupe toujours entre 5 et 10 divisions horizontales, ce qui affiche entre une et deux périodes à l’écran.
Une ligne rouge matérialise la valeur moyenne des sinus et triangles lorsqu’elle est non nulle. Elle n’apparaît pas pour les carrés.
Le calibre vertical est automatiquement affiné autant que possible : les deux crêtes restent dans les 8 divisions de l’écran et les lectures conservent des divisions entières en Easy, des demi-divisions en Medium et des cinquièmes de division en Hard. Pour les sinus et triangles, les candidats dont le sommet est nul ou négatif sont écartés : `Umax` reste strictement positif.
Pour les carrés, les deux plateaux restent à au moins une demi-division des bords supérieur et inférieur. La période repérée commence à la première division verticale et se termine au plus tard au début de la dernière. Le tracé périodique se prolonge jusqu’aux deux bords de la grille, avec un trait légèrement plus épais pour le distinguer du quadrillage.

## Utilisation

1. Ouvrir `index.html` dans un navigateur récent.
2. Choisir les quantités pour chaque type et niveau, ainsi que la graine. Les neuf champs acceptent zéro, mais au moins un oscillogramme doit être demandé.
3. Pour disposer aussi des PNG, cocher **Inclure aussi les PNG dans l’archive**. Les questions Moodle utilisent toujours les WebP, même si les PNG sont inclus.
4. Cliquer sur **Générer l’archive**.
5. Attendre le téléchargement de l’archive.

Pour tester un signal, choisir Easy, Medium ou Hard dans l’aperçu puis cliquer sur **Générer un sinus**, **Générer un triangle** ou **Générer un carré**.

La même graine associée aux mêmes quantités reproduit la même banque.

```text
oscillo-banque-200-OSCILLO-2026-webp.zip
├── easy/      OSC-E-001.webp ... OSC-E-050.webp
├── medium/    OSC-M-001.webp ... OSC-M-100.webp
├── hard/      OSC-H-001.webp ... OSC-H-050.webp
├── moodle/
│   ├── oscillo-easy.xml
│   ├── oscillo-medium.xml
│   └── oscillo-hard.xml
├── inventaire.csv
└── corrige.csv
```

Lorsque des triangles ou carrés sont demandés, leurs images sont placées dans `triangle/<niveau>/` et `carre/<niveau>/`. Le dossier `moodle/` contient alors aussi les fichiers `oscillo-triangle-<niveau>.xml` et `oscillo-carre-<niveau>.xml` correspondants. Si l’option PNG est cochée, chaque PNG est ajouté à côté du WebP homonyme et l’archive porte le suffixe `-webp-png.zip`.

Les CSV UTF-8, séparés par des points-virgules, indiquent le type de signal. L’inventaire contient notamment `Umax`, `T`, `f`, les calibres et les valeurs en divisions ; pour les carrés, il ajoute `Th` et `D`. La case `Umoy` reste vide pour ces derniers. `corrige.csv` associe chaque identifiant aux quatre valeurs à relever. La fréquence est calculée par `f = 1/T` et écrite avec 15 chiffres significatifs quand son développement décimal n’est pas fini.

Chaque question Moodle comporte quatre réponses numériques selon le type de signal. Les unités sont imposées dans l’énoncé et ne doivent pas être saisies. Le point et la virgule sont acceptés. La tolérance est de ±5 %, avec une tolérance absolue de 0,1 division lorsque `Umoy = 0`.

## Technique

- traitement entièrement local ;
- aucune dépendance JavaScript externe ;
- dessin à la résolution native de `Oscilloscope.png`, puis export des images à 900 px de large pour alléger l’archive ;
- images intégrées aux questions Moodle exclusivement en WebP ;
- ZIP créé directement dans le navigateur.

Projet pédagogique — David Chessa.
