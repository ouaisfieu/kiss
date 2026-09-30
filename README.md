# kiss

**Des règles simples. Des mondes entiers.** — huit règles qui tiennent chacune en une phrase, et les structures qu'elles font naître : jeu de la vie, fourmi de Langton, automates élémentaires (règles 30, 90, 110), nuée de boids, tournesol et angle d'or, ensemble de Mandelbrot, planche de Galton, jeu du chaos.

En ligne : <https://ouaisfieu.github.io/kiss/>

## Fidèle à son nom

- `index.html`, `kiss.css`, `kiss.js`. C'est tout. Pas de build, pas de dépendance, pas de framework.
- Chaque simulation ne calcule que lorsqu'elle est visible, et respecte la préférence « réduire les animations ».
- Sombre par défaut, thème clair disponible. Aucun cookie, aucun traceur, aucune ressource tierce.
- SEO : balises Open Graph, `sitemap.xml`, `robots.txt`, JSON-LD schema.org (`WebSite`, `Article` + `LearningResource`, une `CreativeWork` par expérience reliée à Wikipédia).

## Mise en ligne

Pousser sur `main`, puis *Settings → Pages → Deploy from a branch → `main` / `(root)`*.

Pour tester en local : `python3 -m http.server` puis ouvrir `http://localhost:8000/` (la page 404 suppose le chemin `/kiss/`).

## Auteur et licences

Textes et code écrits par Claude (IA, Anthropic), avec carte blanche, à l'invitation d'un éditeur anonyme.
Textes : [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr). Code : licence MIT (voir `LICENSE`).
