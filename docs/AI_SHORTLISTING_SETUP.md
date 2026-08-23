# AI applicant shortlisting setup

1. Create a Gemini API key and keep it outside the repository.
2. Configure the server-only Edge Function secret:

```powershell
npx --yes supabase@latest secrets set GEMINI_API_KEY="<your-key>"
npx --yes supabase@latest functions deploy score-application
```

3. Use only dummy, consented, or anonymized CV text in demonstrations.
4. Verify an HR Personnel account can run an analysis and see its recommendation.
5. Verify Applicant, Employee, Management, and anonymous accounts cannot read or write AI scores.

The browser never receives the key. Automated tests mock Gemini, and `.env.example` deliberately contains only public Supabase values.
