# Claude Agent Setup Reference

## Project purpose
This project is a Next.js React application for a finance advisor assistant. It uses:
- Next.js for the web frontend and API routes
- Supabase for shared data storage (banks, knowledge, cases, users)
- Anthropic Claude via a secure server-side API route
- Environment variables for all secrets and keys

## Security and environment variables
Do not hard-code credentials in the source code.
Use `.env.local` with these values:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server only)
- `ADMIN_CODE` — private registration code for admin accounts
- `ANTHROPIC_API_KEY` — secret Claude API key

## Project structure
- `pages/` — Next.js page routes and API routes
- `pages/api/chat.js` — server-side Claude request proxy
- `pages/api/login.js` — login endpoint with password verification
- `pages/api/register.js` — registration endpoint with admin code support
- `lib/` — reusable helper modules
- `styles/` — global and home page CSS
- `README.md` — setup and run instructions
- `claude.md` — project summary and expectations

## How the agent works
1. The app authenticates users with a simple login/register flow.
2. Banks, knowledge articles, and example cases are loaded from Supabase.
3. The agent builds a structured Claude prompt from registered banks, strategies, and calculator data.
4. The browser sends chat requests to `/api/chat`.
5. The server forwards secure messages to Anthropic Claude with the secret API key.

## High-level developer notes
- Authentication uses server-side hashing (`bcryptjs`) and Supabase service role key.
- The Claude key never appears in client code.
- Public Supabase values are exposed only through `NEXT_PUBLIC_*` keys.
- The app is built for maintainability with small utilities and reusable data models.

## Next steps for a non-technical user
1. Copy `.env.example` to `.env.local`.
2. Fill in your Supabase and Anthropic credentials.
3. Run `npm install` and then `npm run dev`.
4. Create the Supabase tables before first use:
   - `af_users`
   - `af_banks`
   - `af_knowledge`
   - `af_cases`
5. Use the web UI to register or log in, then add banks and strategies.
