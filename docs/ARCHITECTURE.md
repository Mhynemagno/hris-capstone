# Architecture

```mermaid
flowchart LR
  User[Applicant / Employee / HR / Admin / Management] --> Web[Next.js App Router on Vercel]
  Web --> Auth[Supabase Auth]
  Web --> API[Supabase Data API]
  API --> RLS[PostgreSQL with RLS]
  Web --> Storage[Private Supabase Storage]
  Web --> Functions[Supabase Edge Functions]
  Functions --> Gemini[Gemini: anonymized or consented CV data only]
  Vendor[Attendance CSV/XLSX or future documented vendor API] --> Functions
  Functions --> RLS
  RLS --> Reports[Private reporting functions / role-safe RPCs]
```

Browser clients use the publishable key and RLS-protected Data API only. Privileged multi-step operations—account invitation, profile approval, AI scoring, and attendance import—run in validated Edge Functions or narrowly scoped database RPCs. Storage buckets are private. The architecture stores normalized attendance logs only; it never stores raw biometric templates or images.
