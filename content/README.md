# Editing the site

Everything the page says lives in this folder. Edit a file, commit to `main`, and the GitHub Action rebuilds the site.

| File | What it holds |
| --- | --- |
| `site.json` | Name, headline, role, links (Scholar, ORCID, IEEE, Shinkai website), the four big figures. `showTodos: false` hides every TODO slot before going live. |
| `news.json` | News items, newest first. The item with `"lead": true` is set large at the top. |
| `publications.bib` | Every paper. Add a BibTeX entry and it appears, with filters, search and copy-BibTeX. Use `keywords` for topics and `note = {abstract}` or `{preprint}`. |
| `research.json` | The six research lines. A paper appears under a line when its `keywords` include the line's `id`. |
| `shinkai.json` | Shinkai-Labs mission and products. Replace a `{ "todo": true }` item with a real product. |
| `journey.json` | The India and Japan timeline. `country` picks the lane; `kind: "study"` draws an outlined bar. |
| `honours.json` | Grants, copyrights, session chairs, talks, awards. |
| `teaching.json` | Courses, supervision, student achievements. |

The portrait is `src/assets/portrait.jpg` (resized automatically). `public/assets/photo.jpg` and `public/assets/KA_Muthukumar_CV.pdf` stay at their old URLs.
