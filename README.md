# Alti Finans – Intelligence System

## Deployment til Vercel (10 minutter)

### Steg 1 – GitHub
1. Gå til github.com og logg inn / opprett konto
2. Klikk "New repository" → gi den navn "altifinans-agent" → Public → Create
3. Last opp alle filene i dette prosjektet

### Steg 2 – Vercel
1. Gå til vercel.com → logg inn med GitHub
2. Klikk "New Project" → velg "altifinans-agent"
3. Under "Environment Variables" legg inn:
   - ANTHROPIC_API_KEY = sk-ant-... (din nøkkel)
   - NEXT_PUBLIC_SB_URL = https://noknpaopqfqblxovzihi.supabase.co
   - NEXT_PUBLIC_SB_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   - NEXT_PUBLIC_ADMIN_CODE = altifinans2026
4. Klikk "Deploy"
5. Etter 2 minutter er nettsiden live på en URL som altifinans-agent.vercel.app

### Tilgangsstyring
- Du oppretter rådgiverkontoer med admin-koden
- Hvis noen slutter: logg inn som admin og slett brukeren fra Supabase
- Rådgiverne trenger ingen Claude-konto

### Kostnader
- Vercel hosting: Gratis
- Supabase database: Gratis
- Anthropic API: betales per bruk (~1-3 kr per kundesamtale)
