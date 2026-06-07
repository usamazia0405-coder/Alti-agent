# Alti Finans – Intelligence System v2.0

## Kom i gang (Vercel-deploy)

### Steg 1 – Miljøvariabler i Vercel

Gå til Vercel → prosjektet ditt → Settings → Environment Variables og legg inn:

| Variabel | Verdi | Hvor finner du den |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase → Settings → API (hemmelig!) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | console.anthropic.com |
| `SESSION_SECRET` | minst 32 tilfeldige tegn | Lag selv, del aldri |
| `OWNER_EMAIL` | din@epost.no | E-posten du bruker som admin |

**Slett gammel variabel:** Fjern `NEXT_PUBLIC_ADMIN_CODE` hvis den finnes.

**SESSION_SECRET eksempel:** `xK9#mP2@qL5vN8wR3yT6uB1cF4dG7hJ0`

### Steg 2 – Supabase database

Gå til Supabase → SQL Editor og kjør innholdet fra filen `supabase/schema.sql`.
Dette oppretter tabellene og låser dem for direkte tilgang fra nettleseren.

### Steg 3 – Deploy

Push til GitHub så deployer Vercel automatisk:
```
git push
```

### Steg 4 – Første innlogging

Registrer deg med e-posten som er satt i `OWNER_EMAIL`.
Du blir automatisk admin. Ingen admin-kode trengs.

---

## Slik fungerer admin

- **Deg (eieren):** Permanent admin. Kan aldri degraderes.
- **Gi admin til ansatte:** Logg inn → Admin-fanen → klikk "Gi admin" ved siden av brukeren.
- **Fjerne admin:** Admin-fanen → klikk "Fjern admin".
- **Ingen kan gjøre seg selv til admin** – det er umulig i systemet.

---

## Filstøtte

Agenten kan analysere disse filtypene:
- **PDF** – lånesøknader, kontrakter
- **Word (.docx)** – dokumenter
- **Excel (.xlsx, .xls, .csv)** – kalkulatorer, regneark
- **Google Regneark** – eksporter som Excel eller CSV
- **Bilder/skjermbilder** – PNG, JPG, WEBP

---

## Kostnader

| Tjeneste | Kostnad |
|---|---|
| Vercel hosting | Gratis |
| Supabase database | Gratis |
| Anthropic API | ~1–3 kr per kundesamtale |

---

## Feilsøking

Alle filer er organisert slik:
- `lib/` – databasetilgang, autentisering, filparsing
- `pages/api/` – alle API-endepunkter (ingen database-tilgang fra nettleser)
- `components/` – én fil per skjermvisning
- `supabase/schema.sql` – databaseoppsett

Hvis noe ikke fungerer: sjekk Vercel-loggene under Functions-fanen.
