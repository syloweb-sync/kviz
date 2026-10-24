# Arhitektura

Ovaj dokument opisuje kako Pitalica vodi igru uživo: stanja igre, realtime događaje, podatkovni model i način na koji server ostaje jedini izvor istine.

## Pregled

```
 Mobitel igrača ─┐                         ┌─ Supabase Postgres (RLS, funkcije)
 Ekran domaćina ─┼─ HTTPS ─▶ Next.js route handleri ─┤
 Uređivač ───────┘   ▲       (autoritativna logika)  └─ Supabase Storage (slike)
                     │                │
                     │      REST broadcast „stanje v{N}”
                     │                ▼
                     └──── Supabase Realtime (kanal game:<uuid>, presence)
```

- **Čitanje stanja:** klijent uvijek dohvaća vlastiti, autorizirani prikaz preko `GET /api/games/:id/state`.
  - Igrač šalje zaglavlje `x-player-token`.
  - Domaćin šalje Supabase kolačić sesije.
- **Pisanje:** odgovori, akcije domaćina i ulazak u igru idu preko `POST` ruta. Server provjerava prava, primjenjuje promjenu u bazi i zatim objavljuje realtime događaj.
- **Realtime nosi samo signal.** Događaj kaže „promijenilo se, verzija N” i ne sadrži odgovore ni bodove. Klijent nakon njega ponovno dohvati stanje. Zato je obrada idempotentna, a propušteni događaji ne smetaju.

## Domenski sloj (`src/lib/domain`)

Čisti TypeScript bez I/O-a, isti na serveru i (za pregled u uređivaču) na klijentu:

| Modul | Odgovornost |
|---|---|
| `schema.ts` | Zod sheme dokumenta kviza (verzija 1), postavke igre, uvoz i izvoz |
| `question-defaults.ts` | metapodaci tipova, tvornice pitanja sa zadanim vrijednostima, množitelj bodova |
| `validation.ts` | provjera spremnosti za igru (poruke na hrvatskom) |
| `public-view.ts` | prikaz pitanja za igrača bez odgovora, točan odgovor za otkrivanje |
| `answers.ts` | Zod sheme odgovora po tipu, pretvorba javnih ID-jeva u stvarne |
| `scoring.ts` | jedno pravilo bodovanja po tipu, bonus za brzinu |
| `results.ts` | statistika pitanja (raspodjela, histogram, grupe tekstova, Borda) |
| `ranking.ts` | poredak igrača i timova, izjednačenja |
| `state-machine.ts` | prijelazi stanja i provjera roka |
| `normalize.ts`, `nickname.ts`, `random.ts` | normalizacija teksta, nadimci, seeded shuffle i javni ID-jevi |

## Stanja igre

```
          start                 close_question               next
 lobby ─────────▶ question_active ─────────────▶ question_revealing ─────▶ leaderboard
                    │   ▲  ▲                          │                       │
              pause │   │  └───────────── next ───────┼───────────────────────┘
                    ▼   │ resume                      │ (zadnje pitanje ili ljestvica isključena)
                  (pauzirano)                          ▼
                                                    finished

 end:    lobby → cancelled, igra u tijeku → finished
 cancel: bilo koje nezavršeno stanje → cancelled
```

- **Prijelaz** je čista funkcija (`transition`). Server ga zapisuje uvjetnim `UPDATE ... WHERE state_version = N` i povećava verziju. Ako dvoje istodobno klikne, uspijeva samo jedan, a drugi dobiva `409 stale_version`.
- **Početak pitanja** postavlja `question_started_at = sada + 3 s` (priprema) i `question_deadline = početak + vrijeme pitanja`. Klijenti odbrojavaju prema tom roku, uz pomak sata izračunat iz `serverNow`.
- **Pauza** sprema preostalo vrijeme (`paused_remaining_ms`) i briše rok. Nastavak postavlja novi rok i pomiče početak, pa se vrijeme pauze ne broji u brzinu odgovora.
- **Zatvaranje pitanja** događa se:
  1. kad domaćin klikne „Završi pitanje” ili „Otkrij odgovor”
  2. kad svi aktivni igrači odgovore (klasično i timovi, osim ako je dopuštena promjena odgovora)
  3. „lijeno”, kad bilo koje čitanje stanja nakon `roka + 600 ms` (osim kod ručnog vođenja) primijeni prijelaz `close_question`

  Zbog trećeg načina nije potreban pozadinski proces za mjerenje vremena.
- **Završna obrada pitanja** (`finalize_question`): sprema statistiku, pamti poredak prije pitanja (za strelice promjene) i ponovno računa bodove iz odgovora. Idempotentna je. Ako se zahtjev prekine nakon zatvaranja, sljedeće čitanje stanja je dovršava.

## Odgovori

1. Server učitava sesiju i autentificira igrača (hash tokena).
2. Provjerava stanje, indeks pitanja i rok. Odgovori stigli prije početka ili poslije roka plus tolerancije se odbijaju.
3. `resolveAnswer` validira oblik odgovora i pretvara javne ID-jeve u stvarne; nepoznati ID je greška.
4. `evaluateAnswer` i `computePoints` računaju rezultat. Vrijeme odgovora računa server: `sada − početak`, ograničeno na vrijeme pitanja.
5. Funkcija `submit_answer` uzima `FOR SHARE` lock na retku sesije i ponovno provjerava stanje, pa se ne može preklopiti sa zatvaranjem. Upis je jedinstven po `(igrač, pitanje)`, uz izmjenu samo ako je domaćin dopustio promjenu odgovora.
6. Objavljuje se događaj `answer_submitted`. Domaćin osvježi brojač, a igrači ga ignoriraju.

## Realtime događaji

Kanal: `game:<session-uuid>`, događaj `game`, sadržaj:

```ts
{ id: string; type: GameEventType; sessionId: string; version: number; at: number }
```

| `type` | Kada |
|---|---|
| `lobby_updated` | igra stvorena, promjena tima |
| `player_joined` | novi igrač |
| `player_left` | igrač izašao ili uklonjen |
| `game_started` | domaćin je pokrenuo igru |
| `question_started` | sljedeće pitanje |
| `answer_submitted` | zaprimljen odgovor (signal samo za domaćina) |
| `question_ended` | pitanje zatvoreno |
| `results_published` | statistika spremna ili promijenjena (npr. nakon ručnog pregleda) |
| `leaderboard_updated` | prikaz ljestvice |
| `game_paused` / `game_resumed` | pauza |
| `game_finished` / `game_cancelled` | kraj |

Napomene:
- **Pohrana:** događaji se zapisuju i u `game_events` (za reviziju) i brišu nakon 30 dana.
- **Presence** na istom kanalu domaćinu pokazuje koji su igrači trenutačno povezani.

**Pouzdanost** (`src/components/game/use-game.ts`):
- zahtjevi se spajaju: najviše jedan u tijeku i jedan na čekanju
- dok kanal nije spojen, stanje se osvježava svakih 2,5 s, a dok je spojen, svakih 12 s kao zaštitna mreža
- stanje se ponovno provjerava kad se kartica vrati u fokus, kad se mreža vrati i kad se kanal ponovno pretplati
- duplikati događaja (isti `id`) se ignoriraju

## Podatkovni model

| Tablica | Sadržaj |
|---|---|
| `profiles` | ime domaćina (stvara ga okidač pri registraciji) |
| `quizzes` | metapodaci, `is_playable`, `issue_count`, `question_count`, `practice_shared` |
| `quiz_questions` | jedno pitanje po retku: `question_key`, `position` (jedinstven, odgođena provjera), `type`, `data` (JSONB validiran Zodom; tip mora odgovarati) |
| `quiz_media` | evidencija uploada (vlasnik, putanja, MIME, veličina) za čišćenje |
| `game_sessions` | PIN (jedinstven među aktivnim igrama), način, postavke, zamrznuta kopija kviza (`quiz_snapshot`), redoslijed pitanja, tajni seed, stanje i verzija, rokovi |
| `game_teams` | timovi igre |
| `game_players` | nadimak (jedinstven bez obzira na velika i mala slova), hash tokena, tim, bodovi, broj točnih, vrijeme, prethodni poredak |
| `game_answers` | jedan odgovor po igraču i pitanju: interni odgovor, status, udio, bodovi, vrijeme |
| `game_question_results` | statistika svakog pitanja (JSONB) |
| `game_events` | dnevnik događaja |
| `rate_limits` | ograničenja s fiksnim prozorom |

Indeksi pokrivaju PIN, domaćina, kviz, igrače i odgovore po sesiji, tokene, stanje i vrijeme izmjene (za čišćenje) i vlasnika kviza.

**Zamrznuta kopija kviza** znači da izmjena ili brisanje kviza tijekom igre ne utječe na igru u tijeku, a rezultati ostaju čitljivi i nakon brisanja kviza.

## Prikaz za sudionika (`GameView`)

Isti ugovor za domaćina i igrača (`src/lib/game/types.ts`), uz razlike:

- **Domaćin** dobiva sve igrače, PIN tijekom cijele igre i popis odgovora za ručni pregled.
- **Igrač** dobiva prvih 10 na ljestvici plus sebe, PIN samo u predvorju, vlastiti poslani odgovor (za vraćanje sučelja nakon osvježavanja) i rezultat. Rezultat vidi tek nakon zatvaranja pitanja, ili odmah ako pitanje ima trenutnu povratnu informaciju.
- **`reveal`** (točan odgovor i statistika) postoji samo nakon zatvaranja pitanja i poštuje postavke „prikaži točne odgovore” i „prikaži objašnjenja”.

## Skaliranje

- Jedna soba s 20 igrača generira oko 20 zahtjeva po promjeni stanja i jedan zahtjev po odgovoru. Integracijski test pokreće 20 istovremenih igrača s duplim slanjima i paralelnim klikovima na početak.
- Nema stanja u memoriji servera, pa route handleri skaliraju horizontalno (serverless).
- **Mogući sljedeći koraci za veće sobe:**
  - slanje razlika stanja kroz broadcast umjesto ponovnog dohvaćanja
  - privatni kanali s RLS-om
  - agregacija statistike u SQL-u

## Proširivost

- **Novi tip pitanja** dodaje se na ovim mjestima:
  - shema u `schema.ts`
  - zadane vrijednosti i metapodaci
  - pravilo u `validation.ts`, `public-view.ts`, `answers.ts`, `scoring.ts` i `results.ts`
  - uređivač u `components/editor`
  - unos u `answer-input.tsx` i prikaz u `reveal.tsx`

  TypeScript (iscrpni `switch` po diskriminiranoj uniji) javlja svako mjesto koje nedostaje.
- **Uvoz i izvoz** koriste verzionirani format `pitalica-quiz` v1, pa su generatori kvizova (npr. AI ili CSV) samo novi izvori istog dokumenta.
