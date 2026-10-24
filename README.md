# Pitalica — kviz uživo za ekipu

Pitalica je multiplayer platforma za kvizove uživo, za društvene večeri, obiteljska okupljanja, razrede i timove. Domaćin složi kviz i pokrene igru, a igrači ulaze s mobitela preko 6-znamenkastog PIN-a ili QR koda, samo s nadimkom i bez računa. Pitanja se svima pojavljuju istovremeno, bodove računa server, a igra završava ljestvicom i postoljem pobjednika.

- **12 vrsta pitanja**, svaka s vlastitim uređivačem, sučeljem na mobitelu i pravilom bodovanja
- **Igra uživo** preko Supabase Realtimea, s rezervnim osvježavanjem kad realtime nije dostupan
- **Server odlučuje o svemu**: stanja igre, rokovi, provjera odgovora i bodovi
- **Načini igre**: klasično, timovi, ručno vođenje i samostalna vježba
- **Testirano s 20 istovremenih igrača**, a arhitektura nema ograničenje broja soba

> Sučelje je na hrvatskom jeziku, a kod i komentari na engleskom.

---

## Sadržaj

1. [Značajke](#značajke)
2. [Tehnologije](#tehnologije)
3. [Brzi start (lokalno)](#brzi-start-lokalno)
4. [Postavljanje Supabasea (produkcija)](#postavljanje-supabasea-produkcija)
5. [Varijable okruženja](#varijable-okruženja)
6. [Deploy na Vercel](#deploy-na-vercel)
7. [Testovi](#testovi)
8. [Struktura projekta](#struktura-projekta)
9. [Sigurnosni model](#sigurnosni-model)
10. [Bodovanje](#bodovanje)
11. [Poznata ograničenja](#poznata-ograničenja)
12. [Rješavanje problema](#rješavanje-problema)

Detaljna arhitektura (stanja igre, realtime događaji, baza): [`docs/ARHITEKTURA.md`](docs/ARHITEKTURA.md).

---

## Značajke

**Domaćin (potreban račun)**
- Registracija, prijava, odjava i oporavak lozinke e-mailom (Supabase Auth)
- Nadzorna ploča s pretragom, filtrima (spremni / skice) i sortiranjem; kvizovi se mogu duplicirati, brisati (uz potvrdu), izvesti u JSON, pregledati, vježbati i pokrenuti
- Uređivač kviza:
  - pitanja se presložu povlačenjem (miš, dodir, tipkovnica) ili strelicama
  - automatsko spremanje s jasnim statusom
  - slike s prikazom napretka uploada
  - pregled pitanja onako kako ga vidi igrač, s lokalnim ocjenjivanjem
  - provjera spremnosti prije igre
  - uvoz i izvoz u JSON
  - poveznica za vježbu
- Ekran za projektor: veliki PIN, QR kod, popis igrača s oznakom tko je povezan, uklanjanje igrača, dodjela timova, pauza, prečaci na tipkovnici (Razmak, P), cijeli zaslon, zvuk i glazba
- Povijest igara s paginacijom i detaljnim rezultatima svakog pitanja

**Igrač (bez računa)**
- PIN ili QR kod, nadimak, izbor tima
- Sučelje za jednu ruku: veliki gumbi, oblici uz boje (lakše za daltoniste)
- Odbrojavanje prema zajedničkom serverskom roku, uz kratku pripremu prije svakog pitanja
- Nakon osvježavanja stranice ili pada veze igrač se vraća na isto mjesto; vidljiv je i status veze

**Vrste pitanja**

| Vrsta | Igrač | Bodovanje |
|---|---|---|
| Jedan točan odgovor | dodir na karticu | točno / netočno |
| Više točnih odgovora | označi pa pošalji | cijeli skup ili djelomično |
| Točno / netočno | dva velika gumba | točno / netočno |
| Klizač procjene | klizač, +/– | tolerancija, s bodovima prema blizini |
| Kratki odgovor | upis teksta | točno podudaranje uz normalizaciju, opcionalno ručni pregled |
| Brojčani odgovor | numerička tipkovnica | tolerancija, cijeli ili decimalni broj |
| Pribadača na slici | dodir na sliku | radijus, prema udaljenosti |
| Poredaj redom | povlačenje ili strelice | točan redoslijed ili djelomično |
| Spoji parove | dodir lijevo pa desno | svi parovi ili djelomično |
| Slike kao odgovori | dodir na sliku | točno / netočno |
| Anketa | dodir | bez bodova, rezultati uživo |
| Rangiranje | povlačenje ili strelice | bez bodova, poredak grupe (Borda) |

---

## Tehnologije

| Sloj | Tehnologija |
|---|---|
| Okvir | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict) |
| Stil | Tailwind CSS 4 (dizajnerski tokeni u `src/app/globals.css`), vlastite komponente na Radix UI primitivima u stilu shadcn/ui |
| Forme i validacija | React Hook Form, Zod 4 (iste sheme na klijentu i serveru) |
| Animacije | Motion (`motion/react`), canvas-confetti |
| Ikone i fontovi | Lucide, Bricolage Grotesque i Plus Jakarta Sans (lokalno preko @fontsource) |
| Povlačenje | dnd-kit |
| Backend | Supabase: Postgres, Auth, Realtime (Broadcast i Presence), Storage |
| Testovi | Vitest (unit i integracija), Playwright (E2E) |
| Deploy | Vercel (uz dnevni cron za čišćenje) |

Zvukovi se sintetiziraju u pregledniku (Web Audio API), pa nema audio datoteka i nema pitanja licence.

---

## Brzi start (lokalno)

**Preduvjeti:** Node.js ≥ 20.9 (preporuka 22), Docker (za lokalni Supabase).

```bash
npm install                 # .npmrc postavlja legacy-peer-deps
npx supabase start          # lokalni Postgres, Auth, Realtime, Storage, Mailpit
cp .env.example .env.local  # zatim upišite vrijednosti koje je ispisao `supabase start`
npm run dev                 # http://localhost:3000
```

`npx supabase start` primjenjuje migracije iz `supabase/migrations/`. U `.env.local` upišite ove vrijednosti iz ispisa naredbe:

| Ispis `supabase start` | Varijabla |
|---|---|
| `API_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `PUBLISHABLE_KEY` (ili `ANON_KEY`) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `SECRET_KEY` (ili `SERVICE_ROLE_KEY`) | `SUPABASE_SECRET_KEY` |

Lokalni e-mailovi (potvrde, reset lozinke) stižu u Mailpit na http://127.0.0.1:54324.

**Prvi kviz za 30 sekundi:** registrirajte se, na nadzornoj ploči kliknite **Uvezi JSON** i odaberite [`examples/primjer-kviz.pitalica.json`](examples/primjer-kviz.pitalica.json). Zatim pokrenite igru i otvorite `/join` u drugom pregledniku ili na mobitelu u istoj mreži.

Korisne naredbe:

```bash
npm run db:reset    # ponovno stvara lokalnu bazu iz migracija
npm run db:types    # regenerira src/lib/supabase/database.types.ts
npm run lint && npm run typecheck && npm test
```

> Ako `supabase start` ne može preuzeti slike s `public.ecr.aws`, pokrenite ga sa `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start`.

---

## Postavljanje Supabasea (produkcija)

1. **Projekt.** Napravite projekt na [supabase.com](https://supabase.com).
2. **Migracije.**
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   Migracija stvara tablice, indekse, RLS politike, funkcije i Storage bucket `quiz-media` (javno čitanje, najviše 5 MB, samo PNG, JPEG, WebP i GIF).
3. **Auth** (Dashboard → Authentication):
   - **URL Configuration → Site URL:** javni URL aplikacije, npr. `https://pitalica.vercel.app`
   - **Redirect URLs:** `https://pitalica.vercel.app/**` (po potrebi i adrese preview deployova)
   - **Email:** uključite ili isključite „Confirm email” po želji. Aplikacija podržava oba načina: bez potvrde korisnik odmah ulazi, a s potvrdom dobiva poruku da provjeri e-mail.
   - Za produkciju podesite vlastiti SMTP, jer ugrađeni Supabase SMTP ima niska ograničenja slanja.
   - Predlošci e-mailova rade bez izmjena: poveznice vode na `/auth/callback` (PKCE). Ako koristite predloške s `token_hash`, usmjerite ih na `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.
4. **Realtime** (Dashboard → Realtime → Settings): ostavite uključeno **„Allow public access”**. Igra koristi javne Broadcast kanale `game:<uuid>`. Poruke sadrže samo „stanje se promijenilo, verzija N”, nikad odgovore ni bodove, a UUID sesije znaju samo sudionici. Ako je javni pristup isključen, igra i dalje radi, ali se osvježava periodično (svakih 2,5 s) umjesto trenutno.
5. **Ključevi** (Dashboard → Project Settings → API Keys): `publishable` ide u `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, a `secret` u `SUPABASE_SECRET_KEY`. Legacy `anon` i `service_role` ključevi također rade.

---

## Varijable okruženja

| Varijabla | Gdje | Opis |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | klijent i server | URL Supabase projekta |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | klijent i server | publishable (ili legacy anon) ključ; zaštitu podataka osigurava RLS |
| `SUPABASE_SECRET_KEY` | **samo server** | secret (ili service_role) ključ za autoritativne operacije igre. **Nikad** s prefiksom `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | klijent i server | javni URL aplikacije (metapodaci, apsolutne poveznice) |
| `CRON_SECRET` | samo server | štiti `/api/cron/cleanup`; Vercel Cron ga šalje automatski |

Primjer je u [`.env.example`](.env.example). Prave tajne se ne commitaju (`.env*.local` je u `.gitignore`).

---

## Deploy na Vercel

1. Uvezite GitHub repozitorij u Vercel. Okvir (Next.js) se prepoznaje automatski, a `vercel.json` postavlja `npm ci` i cron.
2. U **Settings → Environment Variables** dodajte sve varijable iz tablice iznad.
3. Pokrenite deploy, a zatim produkcijski URL dodajte u Supabase **Site URL** i **Redirect URLs**.
4. Cron `/api/cron/cleanup` pokreće se jednom dnevno (03:17 UTC). On:
   - otkazuje predvorja neaktivna 6+ sati
   - zatvara zaglavljene igre
   - briše otkazane igre starije od 7 dana
   - poništava tokene igrača 2 dana nakon igre
   - čisti stare događaje i zapise ograničenja

Nije potreban zaseban server za igru. Rokovi se provjeravaju „lijeno”: svako čitanje stanja zatvara pitanje kojem je istekao rok, a promjene se zapisuju atomarno (compare-and-swap).

---

## Testovi

| Naredba | Što pokreće | Preduvjet |
|---|---|---|
| `npm test` | unit testovi (Vitest, ~100): bodovanje svih tipova, djelomično bodovanje, tolerancije, udaljenost pribadače, redoslijed i parovi, javni prikaz bez odgovora, stanja igre, rokovi, izjednačenja, timovi, nadimci, validacija | ništa |
| `npm run test:integration` | integracijski testovi na pravoj bazi: spremanje kviza, RLS, autorizacija domaćina, PIN, ulazak, odgovori, zatvaranje pitanja, poredak, cijela igra sa svih 12 tipova, **20 istovremenih igrača**, timovi, vježba, ručni pregled, Storage politike, čišćenje, ograničenje PIN-a | `npx supabase start` i `.env.local` |
| `npm run test:e2e` | Playwright: domaćin gradi kviz u uređivaču i igra s dva igrača; svaki tip pitanja kroz sučelje igrača; ponovno spajanje; zabranjene radnje; ručni pregled; timovi; vježba; alati uređivača (upload, dupliciranje, brisanje, presloži, pregled, izvoz i uvoz); pretraga na ploči; odjava i reset lozinke e-mailom | kao gore. Test sam napravi produkcijski build i pokrene ga na portu 3100. |

```bash
npm run test:all
E2E_BASE_URL=http://localhost:3000 npm run test:e2e   # koristi već pokrenut dev server
QA=1 npx playwright test visual.qa                    # snimke zaslona za dizajnerski pregled
```

Playwright je prikvačen na 1.63.0 zbog preglednika instaliranog u razvojnom okruženju. Na drugim računalima pokrenite `npx playwright install chromium`.

---

## Struktura projekta

```
src/
  app/                      # Next.js rute (stranice + /api route handleri)
    (auth)/                 # prijava, registracija, reset lozinke
    (app)/                  # nadzorna ploča, povijest igara, račun
    quizzes/[id]/           # uređivač, pregled, postavljanje igre
    host/[id]/              # ekran domaćina (projektor)
    play/[id]/  join/  practice/[quizId]/
    api/                    # quizzes, media, games, join, practice, cron
  components/
    ui/  brand/  site/  home/  app/  auth/
    editor/                 # uređivač kviza i uređivači po tipu pitanja
    game/                   # dijeljeno: unos odgovora, rezultati, odbrojavanje, ljestvica, realtime hook
    host/  player/
  lib/
    domain/                 # čista logika bez I/O: sheme, bodovanje, javni prikaz, stanja, poredak
    server/                 # samo server: auth, HTTP, rate limit, kvizovi, games/ (servis igre)
    client/                 # samo klijent: API, upload, zvuk, sesija igrača, izvoz
    supabase/               # klijenti + generirani tipovi baze
    game/types.ts           # ugovor GameView / GameEvent između servera i klijenta
supabase/migrations/        # SQL shema, RLS, funkcije, Storage
tests/unit | integration | e2e | support
examples/                   # primjer kviza za uvoz
docs/ARHITEKTURA.md
```

---

## Sigurnosni model

- **Igrači ne pristupaju bazi izravno.** Sva čitanja i pisanja igre idu kroz route handlere koji koriste secret ključ, i to tek nakon provjere:
  - domaćina: Supabase sesija i `host_id`
  - igrača: tajni token; u bazi se čuva samo njegov SHA-256
- **RLS na svim tablicama.** Korisnik vidi i mijenja samo svoje kvizove. Domaćin može samo **čitati** svoje igre. Uloga `anon` nema nikakva prava nad tablicama igre, a funkcije igre (`submit_answer`, `finalize_question`…) može izvršiti samo `service_role`.
- **Točni odgovori se ne šalju prije zatvaranja pitanja.**
  - Javni prikaz pitanja uklanja točne odgovore, ciljeve, tolerancije i prihvatljive odgovore.
  - ID-jevi opcija zamjenjuju se izvedenima iz tajnog seeda igre.
  - Stavke za slaganje uvijek se miješaju, a desni stupac parova ima posebne ID-jeve.
  - Sve to provjeravaju i testovi.
- **Klijent ne određuje bodove ni vrijeme.**
  - Rok, početak pitanja i vrijeme odgovora računa server.
  - Odgovor se upisuje pod zaključavanjem retka sesije, pa ne može „proći” nakon zatvaranja.
  - Jedinstveni ključ `(igrač, pitanje)` sprječava dvostruke bodove.
  - Prijelazi stanja koriste `state_version` (compare-and-swap), pa dvostruki klik ne preskače pitanje.
- **Ograničenja pokušaja** su u bazi, pa rade i na serverlessu:
  - promašeni PIN-ovi (12/min po IP-u; uspješni ne troše limit, pa cijeli razred iza istog NAT-a može ući)
  - ulasci u igru, odgovori, stvaranje igara, uploadi
- **Storage:** upload ide preko jednokratnog potpisanog URL-a na putanju `<user-id>/<uuid>.<ext>`. Bucket provjerava MIME tip i veličinu, a RLS na `storage.objects` dopušta pisanje samo u vlastitu mapu.
- **Ostalo:**
  - validacija Zod shemama na klijentu i serveru, plus ograničenja u bazi
  - zaštita od otvorenih preusmjeravanja (`?next=`)
  - sigurnosna HTTP zaglavlja
  - filtar uvredljivih nadimaka (domaćin ga može isključiti)

---

## Bodovanje

Sve bodove računa `src/lib/domain/scoring.ts` na serveru. Svako pitanje daje udio `f` između 0 i 1:

| Tip | Pravilo |
|---|---|
| Jedan točan, slike, točno/netočno | `f = 1` za točan odgovor, inače 0 |
| Više točnih | 1 samo za točan skup; s djelomičnim bodovanjem `max(0, (točno označeni − pogrešno označeni) / broj točnih)` |
| Klizač | samo točno: 1 ili 0; inače unutar ±tolerancije točno, a s „bodovima prema blizini” 100 % na cilju i 50 % na rubu |
| Brojčani | `|odgovor − cilj| ≤ tolerancija` |
| Kratki odgovor | podudaranje nakon odabrane normalizacije (razmaci, velika/mala slova, dijakritici). Bez približnog (fuzzy) podudaranja. Uz ručni pregled nepodudarni odgovori čekaju odluku domaćina. |
| Pribadača | udaljenost u jedinicama širine slike, uz poštivanje omjera stranica (koordinate su normalizirane 0–1); unutar radijusa točno, s ocjenom prema blizini 100 %–50 % |
| Poredaj | 1 za točan redoslijed; djelomično = stavke na točnom mjestu / ukupno |
| Spoji parove | 1 za sve parove; djelomično = točni parovi / ukupno |
| Anketa, rangiranje | nikad ne boduju |

**Bodovi** = `osnovica × množitelj (0/1/2) × f`. S bonusom za brzinu polovica je zajamčena, a druga polovica linearno pada s vremenom odgovora (kao u Kahootu). Bodovi nikad nisu negativni.

**Izjednačenja:** igrači s istim bodovima dijele mjesto (1, 1, 3). Redoslijed prikaza unutar istog mjesta određuje broj točnih odgovora, zatim ukupno vrijeme odgovora, pa vrijeme ulaska.

**Timovi:** bodovi tima su prosjek bodova članova, pa veći tim nema prednost.

---

## Poznata ograničenja

- **Hostani Supabase nije testiran.** Svi testovi rađeni su na lokalnom Supabase stacku (Docker). Integracija s hostanim projektom implementirana je istim API-jem, ali nije mogla biti provjerena bez stvarnih ključeva.
- **Bez obrade slika.** Slike se ne smanjuju na serveru, nego se prikazuju preko javnog Storage URL-a. Supabase Image Transformations (plaćeni dodatak) mogu se uključiti kasnije u `src/lib/media.ts`.
- **Čišćenje nekorištenih slika** briše samo vlasnikove datoteke starije od sat vremena koje ne koristi nijedan kviz ni igra u tijeku, i pokreće se nakon brisanja kviza. Slike završenih igara mogu nestati iz detaljnih rezultata ako je kviz obrisan.
- **Vrijeme odgovora** mjeri se satom aplikacijskog servera, pa mrežna latencija igrača (obično < 200 ms) ulazi u bonus za brzinu. Rok ima toleranciju od 600 ms.
- **Realtime kanali su javni Broadcast kanali** (vidi gore): u njima nema tajnih podataka, a privatni kanali s RLS-om mogući su kao nadogradnja.
- **Video nije podržan** (namjerno izostavljen iz MVP-a).
- **Sučelje je samo na hrvatskom**, ali su tekstovi grupirani po komponentama pa je prijevod izvediv.
- **Nema javne biblioteke kvizova ni AI generiranja.** Arhitektura je spremna za to (verzionirana JSON shema, uvoz i izvoz, odvojena domenska logika), ali te značajke nisu implementirane ni lažno prikazane.

---

## Rješavanje problema

| Problem | Rješenje |
|---|---|
| „Aplikacija nije konfigurirana” | Nedostaju `NEXT_PUBLIC_SUPABASE_*` ili `SUPABASE_SECRET_KEY`. Provjerite `.env.local` ili varijable na Vercelu. |
| Igrači ne vide promjene odmah | Provjerite je li u Supabase Realtime postavkama uključen javni pristup. Bez njega aplikacija se osvježava svakih 2,5 s. |
| Poveznica za reset lozinke vodi na login s greškom | URL aplikacije mora biti u **Redirect URLs**, a link se mora otvoriti u istom pregledniku u kojem je zatražen (PKCE). |
| Upload slike ne uspijeva | Datoteka mora biti PNG, JPEG, WebP ili GIF do 5 MB. Bucket `quiz-media` stvara migracija; provjerite je li `supabase db push` izvršen. |
| „Previše pokušaja” | Ograničenje po IP-u traje minutu. Kod PIN-a se broje samo promašaji. |
| `npm install` javlja grešku s peer ovisnostima | Repozitorij ima `.npmrc` s `legacy-peer-deps=true`; koristite `npm ci`. |
| Lokalni `supabase start` ne može preuzeti slike | `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start` |
| Playwright ne pronalazi preglednik | `npx playwright install chromium` |
