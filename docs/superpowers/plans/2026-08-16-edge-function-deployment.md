# Edge Function Deployment Reliability Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deploy the merged invitation CORS fix and prevent future drift with a GitHub Actions deployment workflow.

**Architecture:** Current main is the deployment artifact. The Supabase CLI directly deploys the corrected invite-internal-user function. A dedicated workflow deploys only that function when its source changes on main, using an Actions secret rather than a committed credential.

**Tech Stack:** Supabase CLI 2.114.0, GitHub Actions, PowerShell, Vitest, Next.js.

## Global Constraints

- Deploy only invite-internal-user to wcjpyzulbiexvwtmyudq.
- Do not create a migration, modify RLS, or change application source behavior.
- Do not commit or print SUPABASE_ACCESS_TOKEN.
- Trigger workflow only for main changes below supabase/functions/invite-internal-user and support manual dispatch.
- Verify production with OPTIONS, without sending an invitation.

---

### Task 1: Restore the live Edge Function

**Files:**
- Verify: supabase/functions/invite-internal-user/index.ts

**Interfaces:**
- Consumes the merged OPTIONS handler and SDK CORS headers.
- Produces a live endpoint returning HTTP 200 plus allowed-origin and allowed-header CORS values.

- [ ] **Step 1: Record the failing production reproduction**

    $response = Invoke-WebRequest -Method Options -Uri 'https://wcjpyzulbiexvwtmyudq.supabase.co/functions/v1/invite-internal-user' -Headers @{ Origin = 'https://example.com'; 'Access-Control-Request-Method' = 'POST'; 'Access-Control-Request-Headers' = 'authorization,apikey,content-type' } -SkipHttpErrorCheck
    $response.StatusCode

Expected before deployment: 405.

- [ ] **Step 2: Deploy the confirmed function only**

    npx supabase@latest functions deploy invite-internal-user --project-ref wcjpyzulbiexvwtmyudq --use-api

- [ ] **Step 3: Verify production preflight**

    $response = Invoke-WebRequest -Method Options -Uri 'https://wcjpyzulbiexvwtmyudq.supabase.co/functions/v1/invite-internal-user' -Headers @{ Origin = 'https://example.com'; 'Access-Control-Request-Method' = 'POST'; 'Access-Control-Request-Headers' = 'authorization,apikey,content-type' }
    [pscustomobject]@{ StatusCode = $response.StatusCode; AllowOrigin = $response.Headers['Access-Control-Allow-Origin']; AllowHeaders = $response.Headers['Access-Control-Allow-Headers'] } | ConvertTo-Json -Compress

Expected: status 200, wildcard origin, and authorization/apikey/content-type in allowed headers.

### Task 2: Automate function deployment

**Files:**
- Create: .github/workflows/deploy-invite-internal-user.yml
- Verify: .github/workflows/ci.yml remains unchanged.

**Interfaces:**
- Consumes GitHub Actions secret SUPABASE_ACCESS_TOKEN.
- Produces a main-path-filtered job and manual workflow dispatch entry point.

- [ ] **Step 1: Write a failing workflow contract check**

    $workflow = Get-Content -Raw '.github/workflows/deploy-invite-internal-user.yml'
    if ($workflow -notmatch 'supabase/functions/invite-internal-user/\*\*') { throw 'Missing function path filter.' }

Expected: FAIL because the workflow file does not exist.

- [ ] **Step 2: Add the scoped workflow**

    name: Deploy invitation Edge Function

    on:
      push:
        branches: [main]
        paths:
          - supabase/functions/invite-internal-user/**
      workflow_dispatch:

    permissions:
      contents: read

    jobs:
      deploy:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: supabase/setup-cli@v1
          - name: Verify deployment credential
            env:
              SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
            run: test -n "$SUPABASE_ACCESS_TOKEN"
          - name: Deploy invitation function
            env:
              SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
            run: supabase functions deploy invite-internal-user --project-ref wcjpyzulbiexvwtmyudq --use-api

- [ ] **Step 3: Verify the workflow contract**

    $workflow = Get-Content -Raw '.github/workflows/deploy-invite-internal-user.yml'
    if ($workflow -notmatch 'supabase/functions/invite-internal-user/\*\*' -or $workflow -notmatch 'SUPABASE_ACCESS_TOKEN' -or $workflow -notmatch 'functions deploy invite-internal-user') { throw 'Workflow contract failed.' }

Expected: exit 0. The first run after merge requires the repository owner to add SUPABASE_ACCESS_TOKEN.

- [ ] **Step 4: Commit**

    git add .github/workflows/deploy-invite-internal-user.yml
    git commit -m "ci: deploy invitation edge function"

### Task 3: Verify and publish

**Files:**
- Verify: all changed files.

- [ ] **Step 1: Run complete verification**

    npm run test:run
    npm run lint
    npm run typecheck
    npm run build
    git diff --check
    git diff origin/main...HEAD --check

Expected: all checks exit 0 and whitespace checks print nothing.

- [ ] **Step 2: Push and open a draft PR**

    git push -u origin codex/fix-edge-function-deployment
    gh pr create --draft --base main --head codex/fix-edge-function-deployment --title "Automate invitation Edge Function deployment"

The PR describes the direct live deployment and tells the repository owner to add SUPABASE_ACCESS_TOKEN before the workflow can deploy future changes.
