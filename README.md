# Enigmi per Giuseppe

Tre puzzle di logica con certificazione HMAC.

FE statico servito da GitHub Pages. Backend di certificazione su server SOL via PaaS.

- `index.html` — Landing con le 4 card (3 puzzle + reveal)
- `puzzle/{63,59,80}.html` — Pagine singole dei tre enigmi
- `reveal.html` — Pagina finale sbloccata dopo i 3 certificati
- `css/style.css` — Tema dark serif
- `js/app.js` — Controller unico (fetch, localStorage, redirect)

Endpoint BE: `https://sol.massimilianopili.com/apps/puzzle-verify/`
