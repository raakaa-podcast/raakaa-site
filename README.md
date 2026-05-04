# RAAKAA Podcast – sivuston kehittäjäopas

Salamannopea, staattisesti generoitu Astro-sivusto RAAKAA Podcastille. Tämä dokumentti sisältää kaiken, mitä tarvitset sivuston päivittämiseen ilman koodausta: PDF-litterointien lisääminen, vieraiden ja aiheiden hallinta, uutiskirjelähetykset ja Netlify-julkaisu.

---

## Sisällys

1. [Tekninen pohja ja paikallinen kehitys](#1-tekninen-pohja-ja-paikallinen-kehitys)
2. [Sivuston rakenne](#2-sivuston-rakenne)
3. [PDF-litteroinnit (helpoin tapa)](#3-pdf-litteroinnit-helpoin-tapa)
4. [Vieraat ja aiheet jaksokorteille](#4-vieraat-ja-aiheet-jaksokorteille)
5. [RSS.com-syöte ja jaksojen automaattinen päivitys](#5-rsscom-syöte-ja-jaksojen-automaattinen-päivitys)
6. [Yhteydenottolomake](#6-yhteydenottolomake)
7. [Uutiskirjeen tilauslomake](#7-uutiskirjeen-tilauslomake)
8. [Sähköpostien lähettäminen tilaajille (käytännössä)](#8-sähköpostien-lähettäminen-tilaajille-käytännössä)
9. [Netlify-julkaisu vaihe vaiheelta](#9-netlify-julkaisu-vaihe-vaiheelta)
10. [SEO ja suorituskyky](#10-seo-ja-suorituskyky)
11. [Vianmääritys](#11-vianmääritys)

---

## 1) Tekninen pohja ja paikallinen kehitys

- **Astro 6** + TypeScript, **`output: 'static'`** → kaikki sivut esirenderöityjä HTML-tiedostoja.
- **Netlify** hosting (auto-deploy GitHubista).
- **Netlify Forms** yhteydenotto- ja tilauslomakkeisiin.
- **`@astrojs/sitemap`** generoi `sitemap-index.xml` automaattisesti.

### Käynnistys lokaalisti

```bash
npm install
npm run dev    # http://localhost:4321
npm run build  # tuottaa staattiset tiedostot kansioon dist/
npm run preview
```

### Ympäristömuuttuja

`.env`-tiedostoon (älä commitoi):

```bash
PUBLIC_RSS_FEED_URL=https://media.rss.com/raakaapodcast/feed.xml
```

Sama muuttuja pitää lisätä Netlifyyn: **Site configuration → Environment variables**.

---

## 2) Sivuston rakenne

```
src/
├── components/         # Jaetut UI-komponentit (header, footer, kortti, jne.)
├── content/            # Astro Content Collections (Markdown- ja YAML-litteroinnit)
├── data/
│   ├── episode-meta.json   # Vieraat + aihetagit per jakso  (sinä editoit tätä)
│   ├── guests.json         # Vieraiden esittelyt            (sinä editoit tätä)
│   └── litteroinnit.json   # PDF-litterointien metatiedot   (sinä editoit tätä)
├── layouts/
│   └── BaseLayout.astro    # Yhteinen <head>, header, footer, soitin
├── lib/                # Apufunktiot (RSS, kesto, vieraat, transkriptit)
└── pages/              # Astro-sivut → URL-rakenne
    ├── index.astro             # /
    ├── markus.astro            # /markus
    ├── jaksot/index.astro      # /jaksot (haku + suodatin)
    ├── jaksot/[slug].astro     # /jaksot/<slug> (yksittäinen jakso)
    ├── vieraat/index.astro     # /vieraat
    ├── vieraat/[slug].astro    # /vieraat/<slug>
    ├── kiitos.astro            # Yhteydenottolomakkeen kiitossivu
    └── kiitos-tilaus.astro     # Tilauslomakkeen kiitossivu

public/
├── images/             # Pysyvät kuvat (Markus, vieraiden valokuvat, OG-kuva)
├── uploads/            # PDF-litteroinnit
├── netlify-forms/      # Lomakkeiden staattiset rekisteröintitiedostot
├── admin/              # (Valinnainen) Decap CMS
├── favicon.svg
└── robots.txt
```

---

## 3) PDF-litteroinnit (helpoin tapa)

Yksi JSON-tiedosto + yksi PDF-kansio. Ei CMS:ää, ei buildia paikallisesti – riittää että pushaat GitHubiin.

### A) Lataa PDF kansioon `public/uploads/`

1. Avaa repo (Cursor/VS Code/GitHub) ja navigoi `public/uploads/`-kansioon.
2. Vedä PDF kansioon, esim. `public/uploads/jakso-test-litterointi.pdf`.
3. URL sivulla: `/uploads/jakso-test-litterointi.pdf` (ei `public/`-etuliitettä).

### B) Lisää metatieto tiedostoon `src/data/litteroinnit.json`

Avaa tiedosto ja lisää uusi objekti taulukkoon:

```json
[
  {
    "title": "Jakson otsikko – litterointi",
    "episodeSlug": "test",
    "publishDate": "2026-05-04",
    "excerpt": "Lyhyt kuvaus litteroinnista (näkyy listassa).",
    "pdfUrl": "/uploads/jakso-test-litterointi.pdf"
  }
]
```

Kentät:

| Kenttä | Pakollinen | Selitys |
|--------|------------|---------|
| `title` | Kyllä | Litteroinnin näkyvä otsikko. |
| `episodeSlug` | Toinen | Jakson URL-slug, esim. `/jaksot/test` → `test`. |
| `episodeGuid` | Toinen | Vaihtoehtoinen: RSS-feedin `<guid>`-arvo. |
| `pdfUrl` | Kyllä | URL-polku PDF-tiedostoon, alkaa `/uploads/`. |
| `publishDate` | Ei | Päivämäärä (ISO 8601). |
| `excerpt` | Ei | Lyhyt kuvaus. |

### C) Pushaa

```bash
git add public/uploads/ src/data/litteroinnit.json
git commit -m "Lisää PDF-litterointi jaksoon test"
git push
```

Netlify tekee automaattisen deployn ja Litterointi-nappi ilmestyy jaksokorttiin sekä yksittäisen jakson sivulle.

> **Vaihtoehto: YAML/Decap CMS.** `src/content/pdf-transcripts/*.yml` tai admin-panelista (`/admin`). JSON-tapa on yksinkertaisin ja toimii aina.

---

## 4) Vieraat ja aiheet jaksokorteille

Kortilla ja jakson sivulla näytetään automaattisesti **kesto** (RSS-feedistä). Vieraat ja aihetagit lisätään käsin kahdella JSON-tiedostolla.

### A) Lisää vieras tiedostoon `src/data/guests.json`

```json
[
  {
    "slug": "etunimi-sukunimi",
    "name": "Etunimi Sukunimi",
    "role": "Lyhyt rooli (esim. tutkija / yrittäjä / artisti)",
    "bio": "Useamman lauseen esittely vieraasta. Tämä näkyy /vieraat-sivulla ja vieraan omalla profiilisivulla. Voit kirjoittaa rivinvaihtoja \\n -merkillä.",
    "image": "/images/vieraat/etunimi-sukunimi.jpg",
    "links": [
      { "label": "Verkkosivu",  "url": "https://example.fi" },
      { "label": "Instagram",   "url": "https://instagram.com/example" },
      { "label": "LinkedIn",    "url": "https://linkedin.com/in/example" }
    ]
  }
]
```

Kentät:

| Kenttä | Pakollinen | Selitys |
|--------|------------|---------|
| `slug` | Kyllä | URL: `/vieraat/<slug>`. Pienet kirjaimet ja viivat. |
| `name` | Kyllä | Vieraan koko nimi. |
| `role` | Ei | Lyhyt titteli näytetään keltaisella. |
| `bio` | Kyllä | Esittely. |
| `image` | Ei | Polku kuvatiedostoon kansiossa `public/images/vieraat/`. |
| `links` | Ei | Lista ulkoisista linkeistä `{label, url}`. |

> **Kuvat:** lisää `.jpg` tai `.webp` kansioon `public/images/vieraat/`. Ihanteellinen koko 800×800 px.

### B) Yhdistä vieras jaksoon ja lisää aihetagit (`src/data/episode-meta.json`)

```json
[
  {
    "episodeSlug": "test",
    "guests": ["etunimi-sukunimi"],
    "topics": ["yhteiskunta", "talous"],
    "summary": "Vapaaehtoinen lyhyt kuvaus, joka korvaa RSS-feedin kuvauksen kortilla."
  }
]
```

Kentät:

| Kenttä | Pakollinen | Selitys |
|--------|------------|---------|
| `episodeSlug` | Toinen | Jakson URL-slug. |
| `episodeGuid` | Toinen | RSS-feedin `<guid>`. |
| `guests` | Ei | Lista vieraan slugeja. |
| `topics` | Ei | Lista aiheita; näkyy tagina ja toimii suodattimena `/jaksot`-sivulla. |
| `summary` | Ei | Korvaa RSS-kuvauksen kortilla. |

### Lopputulos automaattisesti

- Jaksokortilla: päivämäärä, kesto, otsikko, vieras (linkkinä), kuvaus, aihetagit, napit *Avaa / Toista / Litterointi*.
- `/jaksot`-sivulla hakukenttä (otsikko, kuvaus, vieras, aihe) ja aihechipit.
- `/vieraat`-sivulla kortti per vieras, jakso­määrä laskettuna.
- `/vieraat/<slug>`-sivulla bio, linkit ja kaikki vieraan jaksot.
- Jaksosivulla JSON-LD `PodcastEpisode` + `PodcastSeries` -merkinnät vieraineen ja kestoineen → Google-rikkaat tulokset.

---

## 5) RSS.com-syöte ja jaksojen automaattinen päivitys

Sivusto hakee jaksot **build-vaiheessa** RSS-feedistä. Tämä tarkoittaa:

- Kun julkaiset uuden jakson RSS.comissa, **käynnistä Netlifyssa uusi deploy** (Deploys → **Trigger deploy → Deploy site**).
- Vaihtoehtoisesti aseta Netlifyssa **Build hook** ja kutsu sitä kerran päivässä esim. cron-jobilla, jolloin sivu päivittyy automaattisesti.
- Jaksojen URL-slugit muodostetaan otsikosta. Jos haluat sitoa litteroinnit tai vieraat tunnisteeseen, joka ei muutu otsikon mukana, käytä `episodeGuid`-kenttää.

---

## 6) Yhteydenottolomake

- Lomakkeen nimi: **`yhteydenotto`** (näkyy Netlify Forms -näkymässä).
- Sijainti: etusivu, osio "Ota yhteyttä".
- Lähetys-URL: `/kiitos`.
- Rekisteröinti: `public/netlify-forms/yhteydenotto.html` (Netlify lukee tämän deploy-vaiheessa).

Lähetykset näkyvät: Netlify → **Forms → yhteydenotto → Submissions**. Ota Netlifystä **Forms → Notifications → Email** päälle, jos haluat sähköpostimuistutuksen jokaisesta uudesta lähetyksestä.

---

## 7) Uutiskirjeen tilauslomake

- Lomakkeen nimi: **`tilaus`**.
- Sijainti: etusivu, osio "Tilaa jaksomuistutus" (`#tilaa`).
- Lähetys-URL: `/kiitos-tilaus`.
- Rekisteröinti: `public/netlify-forms/tilaus.html`.

Lomakkeen kentät:

- `sahkoposti` (sähköpostiosoite, pakollinen).
- `suostumus` (pakollinen checkbox – käyttäjä hyväksyy sähköpostiosoitteen käytön muistutuksiin).
- `bot-field` (näkymätön honeypot).

Tilaajat tallentuvat Netlify Formsiin. Voit:

1. **Selailla suoraan Netlifyssa** – Forms → tilaus → Submissions.
2. **Saada sähköposti** jokaisesta uudesta tilauksesta (Notifications → Email).
3. **Viedä CSV** ja syöttää sen sähköpostipalveluusi (kts. seuraava luku).

---

## 8) Sähköpostien lähettäminen tilaajille (käytännössä)

Netlify Forms tallentaa osoitteet, mutta **ei lähetä uutiskirjettä**. Käytännön vaihtoehdot:

### A) Yksinkertaisin: vie CSV ja lähetä joukkokirje

1. Netlify → Forms → **tilaus** → **Export CSV**.
2. Avaa esim. Mailerlitessä, MailChimpissä tai Brevossa: luo audience, importtaa CSV.
3. Lähetä jakson ilmoituskirje.
4. Toimii heti, ei vaadi koodia.

### B) Automaattinen siirto sähköpostipalveluun (suositus pitkällä juoksulla)

1. Tee tili **Mailerlite**, **Brevo**, **Buttondown** tai **MailChimp**.
2. Luo **API key**.
3. Aseta **Netlify function** (`netlify/functions/tilaus-webhook.js`), joka kuuntelee `submission-created` -tapahtumaa ja kutsuu valitsemasi sähköpostipalvelun APIa.
4. Tällöin jokainen uusi tilaaja menee suoraan listalle ilman manuaalista vientiä.

### C) Zapier / Make.com

- Yhdistä Netlify Forms → Mailerlite/MailChimp **ilman koodia**.
- Trigger: "New form submission".
- Action: "Add subscriber".

> Ennen kuin julkaistat tilausvahvistuksia, tarkista että hyväksyntä-checkbox riittää sinulle GDPR:n näkökulmasta. Suostumus tallentuu kentässä `suostumus = kylla`.

---

## 9) Netlify-julkaisu vaihe vaiheelta

### 9.1 GitHub-repo

```bash
git init
git add .
git commit -m "Initial RAAKAA podcast site"
gh repo create raakaa-site --public --source=. --push
```

### 9.2 Netlify-yhdistys

1. Netlify → **Add new site → Import an existing project**.
2. Valitse GitHub ja repo.
3. Build-asetukset (Astro tunnistaa nämä automaattisesti):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. **Deploy site**.

### 9.3 Environment variables

Netlify → **Site configuration → Environment variables**:

| Avain | Arvo |
|-------|------|
| `PUBLIC_RSS_FEED_URL` | `https://media.rss.com/raakaapodcast/feed.xml` |

Tee uusi deploy (**Deploys → Trigger deploy → Clear cache and deploy site**).

### 9.4 Tarkista lomakkeet

1. Avaa tuotanto-URL.
2. Lähetä testi-yhteydenotto → ohjautuu `/kiitos`.
3. Lähetä testitilaus → ohjautuu `/kiitos-tilaus`.
4. Tarkista Netlify → **Forms** → molemmat lomakkeet (`yhteydenotto`, `tilaus`) näkyvät submissioneineen.
5. Aseta **Forms → Notifications → Add notification → Email** molemmille.

### 9.5 Ota oma domain käyttöön

1. Netlify → **Domain management → Add a domain**.
2. Lisää `raakaa.fi` ja `www.raakaa.fi`.
3. Päivitä DNS rekisteröijällä Netlifyn ohjeiden mukaan.
4. Aseta **HTTPS** → automaattinen Let’s Encrypt -sertifikaatti.

---

## 10) SEO ja suorituskyky

Sivusto sisältää valmiina:

- Staattinen `output`. CDN palvelee suoraan HTML:n.
- `compressHTML: true`, `inlineStylesheets: 'auto'`.
- `preconnect` / `dns-prefetch` RSS.com & Unsplash -isännille.
- `loading="lazy"` ja eksplisiittiset `width`/`height` (CLS = 0).
- `prefers-reduced-motion: reduce` -tuki.
- Sitemap: `https://www.raakaa.fi/sitemap-index.xml`.
- `robots.txt`.
- Open Graph + Twitter Cards koko sivustolla.
- JSON-LD: `PodcastSeries`, `PodcastEpisode`, `Person` (Markus + vieraat), `FAQPage`, `Organization`.
- Mobiilihampurilainen valikko + skip-link saavutettavuutta varten.

### Hyvä lisäys

- Pudota `og-image.jpg` (1200×630) kansioon `public/`.
- Submittaa sitemap Google Search Consoleen.

---

## 11) Vianmääritys

| Ongelma | Tee näin |
|---------|----------|
| Lomakkeet eivät näy Netlify Formsissa | Varmista että **Forms detection on päällä** (Forms → Usage and configuration). Pakota uusi deploy: **Clear cache and deploy site**. |
| Spämmiä tulee paljon | Ota käyttöön Netlify reCAPTCHA: lisää `data-netlify-recaptcha="true"` ja `<div data-netlify-recaptcha="true"></div>` lomakkeeseen. |
| Uusi jakso ei ilmesty sivulle | Käynnistä Netlifyssa **Trigger deploy**. RSS-feed luetaan vain build-vaiheessa. |
| Litterointi-nappi ei näy | Tarkista että `episodeSlug` täsmää jakson URL-slugiin. |
| Vieraan kuva ei näy | Tarkista että polku on `/images/vieraat/...` (ei `public/`) ja tiedosto on commitoitu. |
| RSS-feed ei lataudu | Tarkista `PUBLIC_RSS_FEED_URL` Netlifyssa. Sivu ei kaadu, mutta jaksot eivät näy. |
| Mobiilivalikko ei avaudu | JS lataus epäonnistunut → tarkista konsoli. Valikko on inline `<script>`-blokissa, joten yleensä toimii heti. |

---

Onnea! Jos jokin edellisistä ohjeista on epäselvä tai sivulle pitäisi lisätä uusi ominaisuus, kerro – kaikki muutokset tehdään yhdessä paikassa ja siirtyvät tuotantoon yhdellä git-pushilla.
