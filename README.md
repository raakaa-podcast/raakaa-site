# RAAKAA Podcast Website

Nopea Astro-sivusto RAAKAA Podcastille. Sivusto toimii Netlifyssa, hakee jaksot RSS.com-syotteesta, sisaltaa sticky-soittimen ja tukee litterointeja myos PDF-tiedostoina.

## Ominaisuudet

- Responsiivinen tumma UX (musta + keltainen), glassmorphism, sticky player.
- RSS.com-jaksot haetaan automaattisesti build-vaiheessa.
- Yksittaiset jakso-sivut, RSS.com-upotus ja transcriptit.
- Netlify Forms -yhteydenottolomake.
- PDF-litterointien hallinta Decap CMS:n kautta (`/admin`).

## Kaynnistys lokaalisti

```bash
npm install
npm run dev
```

## Ympäristömuuttujat

`.env`:

```bash
PUBLIC_RSS_FEED_URL=https://media.rss.com/raakaapodcast/feed.xml
```

---

## Yksityiskohtainen Netlify-julkaisuohje

### 1) Koodi GitHubiin
1. Luo GitHub-repo (esim. `raakaa-site`).
2. Pushaa projektin tiedostot siihen.

### 2) Uusi sivu Netlifyyn
1. Avaa Netlify -> **Add new site** -> **Import an existing project**.
2. Valitse GitHub ja repo.
3. Build-asetukset:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Deploy.

### 3) Environment variable
1. Netlify -> **Site configuration** -> **Environment variables**.
2. Lisaa:
   - `PUBLIC_RSS_FEED_URL` = `https://media.rss.com/raakaapodcast/feed.xml`
3. Tee uusi deploy (**Deploys -> Trigger deploy**).

### 4) Ota CMS-kirjautuminen kayttoon
1. Netlify -> **Identity** -> **Enable Identity**.
2. Identity -> **Settings and usage** -> **Enable Git Gateway**.
3. Identity -> **Invite users** (laheta itsellesi kutsu).
4. Avaa tuotantosivulla `/admin` ja kirjaudu.

**Jos Decap ei kirjaudu sisään:** tarkista etta `public/admin/config.yml` rivilla `branch:` on sama kuin GitHubin oletushaara (`main` vs `master`). Git Gateway vaatii myos etta sivusto on linkitetty samaan repoon. Kokeile incognito-ikkunaa ja etta olet hyvaksynyt Identity-kutsun.

### Decap-vaihtoehdot (jos Identity ei toimi)

| Tapa | Kuvaus |
|------|--------|
| **GitHub suoraan** | Muokkaa `src/content/pdf-transcripts/*.yml` ja `public/uploads/*` GitHubissa (tai Cursorissa) ja pushaa. Ei erillista CMS:ää. |
| **Decap + GitHub backend** | Vaihda `config.yml`:ssa `backend: name: github` ja GitHub OAuth App. Ei Netlify Identitya. |
| **TinaCMS** | Git-pohjainen editori, usein helpompi kuin Identity+Git Gateway. |
| **Headless CMS** | Esim. Sanity tai Contentful: sisältö APIsta, build hakee datan (vaatii enemmän koodia). |
| **Vain lomake** | PDF-pyynnöt Netlify Formsin kautta; itse lisäät tiedostot repoon. |

### 5) Netlify Forms – lomakkeen rekisterointi ja testaus

Netlify loytaa lomakkeet parsimalla **staattista HTML:ää** deploy-vaiheessa ([dokumentaatio: HTML forms](https://docs.netlify.com/forms/setup/#html-forms)). Tama projekti kayttaa Astroa **SSR-tilassa**, jolloin etusivun lomake ei valttamatta ole staattisessa `dist`-puussa skannattavassa muodossa. Siksi repossa on erillinen rekisterointitiedosto:

- `public/netlify-forms/yhteydenotto.html` – sisaltaa saman lomakkeen (`name`, `method`, `data-netlify`, honeypot ja kenttien `name`-arvot) kuin etusivun lomake.

**Vaiheet:**

1. Netlify UI: **Forms** → **Usage and configuration** → **Form detection** → **Enable form detection** (jos ei jo paalla). Ilman tata Netlify ei rekisteroi lomakkeita.
2. Pushaa koodi (sisaltaen `public/netlify-forms/yhteydenotto.html`) ja odota deployn valmistumista.
3. Avaa deploy-loki: varmista ettei Forms-aiheisia virheita tule.
4. Netlify UI: **Forms** – pitäisi nakya lomake **`yhteydenotto`**.
5. Testaa: avaa tuotannon etusivu, scrollaa **Ota yhteyttä** -lomakkeeseen, täytä ja lähetä. Uudelleenohjaus `/kiitos` tarkoittaa onnistunutta POSTia.

**Lomakkeen vaatimukset (täyttyvat tässä projektissa):**

- `<form name="yhteydenotto" ...>` – `name` on lomakkeen tunniste Netlifyssa.
- Attribuutti `data-netlify="true"` **tai** `netlify` `<form>`-tagissa ([docs](https://docs.netlify.com/forms/setup/#html-forms)).
- `method="POST"`.
- Piilotettu kenttä: `<input type="hidden" name="form-name" value="yhteydenotto" />` (sama kuin `name`).
- Honeypot: `netlify-honeypot="bot-field"` ja kenttä `name="bot-field"`.
- Kaikilla kentilla `name`: `nimi`, `sahkoposti`, `viesti` – samat nimet rekisterointitiedostossa ja etusivulla.

**Jos lomake ei vielä näy:** kaynnista **Clear cache and deploy site**, ja tarkista etta `publish` on `dist` ja etta `public/netlify-forms/` kopioituu buildiin (tiedoston pitaa olla saatavilla osoitteessa `https://<domain>/netlify-forms/yhteydenotto.html`).

---

## PDF-litterointi ilman CMS:aa (GitHub tai Cursor) – tarkat ohjeet

Tama tapa toimii aina: PDF on staattinen tiedosto ja metatiedot ovat versionhallittuja YAML-tiedostoja. Deploy paivittaa sivun automaattisesti.

### Valmistelu: jakson tunniste (`episodeSlug`)

1. Avaa sivusto paikallisesti (`npm run dev`) tai tuotanto.
2. Avaa **Jaksot**-sivu ja klikkaa jakso auki, tai katso URL: `/jaksot/<tama-on-slug>`.
3. Kopioi slug (esim. `test`). Kayta samaa arvoa YAML-tiedostossa kentassa `episodeSlug`.

**Vaihtoehto:** kayta `episodeGuid` RSS-feedin `<guid>`-arvosta (jos haluat sitoa slugin muutoksesta riippumatta).

### Vaihe 1: Lisaa PDF-tiedosto

1. Luo kansio jos puuttuu: `public/uploads/` (projektin juuressa).
2. Kopioi PDF esim. nimella `public/uploads/jakso-test-litterointi.pdf`.
3. Tiedoston URL sivulla on aina polusta: **`/uploads/jakso-test-litterointi.pdf`** (ei `public/` etuliitetta URLissa).

### Vaihe 2: Luo metatiedosto (YAML)

1. Luo tiedosto `src/content/pdf-transcripts/jakso-test-litterointi.yml` (tiedostonimi voi olla kuvaava, ei valttamatta sama kuin slug).
2. Sisältö esimerkiksi:

```yml
title: Jakso TEST – litterointi (PDF)
episodeSlug: test
publishDate: 2026-05-04T12:00:00.000Z
excerpt: Lyhyt kuvaus PDF:stä hakijoille ja ruudulle.
pdfUrl: /uploads/jakso-test-litterointi.pdf
```

Kenttien merkitys:

| Kenttä | Pakollinen | Kuvaus |
|--------|------------|--------|
| `title` | Kyllä | Näkyvä otsikko listauksissa. |
| `episodeSlug` | Toinen | Tasmää jaksoon URL-slugin perusteella. |
| `episodeGuid` | Toinen | Vaihtoehto slugille; RSS-itemin guid. |
| `publishDate` | Ei | Näytetään päivämääränä. |
| `excerpt` | Ei | Lyhyt teksti kortissa. |
| `pdfUrl` | Kyllä | Polku PDF:ään, esim. `/uploads/tiedosto.pdf`. |

**Huom:** `episodeSlug` ja `episodeGuid` – riittää toinen, jos tunniste on yksiselitteinen.

### Vaihe 3a: Tallenna Cursorissa ja pushaa

1. Tallenna molemmat tiedostot (`public/uploads/...` ja `src/content/pdf-transcripts/...yml`).
2. Terminaalissa projektin juuressa:

```bash
git add public/uploads/ src/content/pdf-transcripts/
git status
git commit -m "Lisää PDF-litterointi jaksoon test"
git push
```

3. Netlify tekee automaattisen deployn. Kun deploy on valmis, tarkista etusivun Litteroinnit-osa ja jakson `/jaksot/<slug>` -sivu.

### Vaihe 3b: Lisää GitHubin web-käyttöliittymässä

1. Avaa repo GitHubissa → **Add file** → **Upload files** (tai **Create new file** YAMLille).
2. Lataa PDF polkuun `public/uploads/jakso-test-litterointi.pdf`.
3. Luo uusi tiedosto `src/content/pdf-transcripts/jakso-test-litterointi.yml` (kopioi YAML-sisältö yllä olevasta esimerkistä ja muokkaa).
4. **Commit changes** → odota Netlify-deploy.

### Vaihe 4: Tarkista etta kaikki toimii

1. Avaa etusivu → osio **Saavutettavuus & Litteroinnit** – pitäisi näkyä kortti ja linkki **Avaa PDF**.
2. Avaa `/jaksot/<slug>` → osio **PDF-litterointi** – linkin pitäisi avata PDF.
3. Jos korttia ei näy: tarkista että `episodeSlug` täsmää jakson slugiin kirjain kerrallaan.

---

## PDF Decap CMS:lla (vaihtoehto)

1. Avaa `https://<oma-domain>/admin`.
2. Valitse **PDF-litteroinnit** → **New PDF-litteroinnit**.
3. Täytä kentät ja lataa PDF; **Save** / **Publish**.
4. Tarkista sama kuin yllä kohdassa **Vaihe 4**.

---

## Huomio

- Jaksoon kohdistus toimii kentilla `episodeGuid` tai `episodeSlug`.
- Jos RSS-feed ei ole saatavilla, sivu ei kaadu vaan nayttaa varatekstin.
