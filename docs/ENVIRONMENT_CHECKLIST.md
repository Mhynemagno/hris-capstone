# Environment-variable checklist

| Variable | Platform / owner | Environments | Sensitivity | Rule |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel / project owner | Development, Preview, Production | public | Browser-safe project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel / project owner | Development, Preview, Production | public | Browser-safe publishable key only. |
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions / project owner | CI | secret | Used only for authenticated Supabase CLI deployment. |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function runtime | Function runtime only | secret | Never define as `NEXT_PUBLIC_*` or commit. |
| `APP_URL` | Supabase Edge Function runtime | Production | configuration | Exact deployed application origin for invitation redirects. |
| Gemini provider key | Supabase Edge Function runtime | configured environments | secret | Send only dummy/anonymized/consented CV content. |
| Attendance vendor credential | Supabase Edge Function runtime | only after vendor approval | secret | Never browser-visible; CSV/XLSX import needs none. |

Before release, check that `.env.local`, `.vercel`, Supabase link metadata, credentials, private documents, and test output are ignored and absent from staged files.
