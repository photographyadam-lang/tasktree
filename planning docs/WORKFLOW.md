# RiskHelper.ai — Agent Workflow Prompts
> Copy the prompt for the role you need. Fill in the [BRACKETED] sections. Then paste into your Antigravity session.
> Always start a session by confirming the agent has read AGENTS.md and SESSIONSTATE.md.
> **Antigravity (Claude)** is used for all roles except Reviewer. **Antigravity (Gemini Pro)** is used for the Reviewer role only.

---

## Session start — always use this first

```
Read AGENTS.md and then SESSIONSTATE.md. Summarise:
1. The current phase and what it means for what we're allowed to build
2. The architecture rule you would be most likely to accidentally violate in today's task
3. What I said I was working on (from SESSIONSTATE.md "What I am working on right now")

Do not begin any work until you have done this. If SESSIONSTATE.md "What I am working on right now"
is blank or unset, stop and tell me to fill it in before proceeding.
```

---

## Managing context window degradation

Antigravity sessions working with large files (AGENTS.md, SESSIONSTATE.md, TASKS.md, PLANNING.md, and several code files simultaneously) can hit context limits mid-task. When this happens, agents typically start ignoring earlier constraints — producing code that contradicts the architecture rules, forgetting required comments, or silently dropping acceptance criteria. This failure mode is hard to detect in the moment.

**Signs that context has degraded:**
- The agent produces code that omits a constraint you know was specified (e.g. missing a required `dangerouslySetInnerHTML` comment, using `localStorage`, using `npm install` instead of `npm ci`, missing rate limiting, missing `escapeHtml()` call)
- The agent asks you to re-explain something that was in AGENTS.md
- Responses become shorter and more generic, losing project-specific detail
- The agent starts using patterns that contradict the architecture rules (e.g. putting scoring logic in a client component)

**What to do:**
1. Stop immediately — do not try to correct the agent mid-flow or push through
2. Use the Session End prompt below to save the exact state of your work
3. Start a fresh Antigravity session
4. Paste the handoff note at the start of the new session before doing anything else
5. Verify the new session correctly reads AGENTS.md and SESSIONSTATE.md before continuing

**Prevention:**
- Keep each Antigravity session focused on a single task
- Do not mix planning, building, and testing in the same session
- For tasks that require reading many large files simultaneously (e.g. P1-T07 which reads score.js, index.html, and types.ts), consider splitting the session: one session to read and plan, a fresh session to build

---

## ROLE 1 — Planner
*Use Antigravity (Claude). Run before starting any task.*

### Skip Reviewer — explicit allowlist
Only tasks named in this list may skip the Reviewer step. No agent discretion applies — if a task is not named here, it goes through the Reviewer regardless of apparent simplicity.

**Tasks that may skip the Reviewer:**
- `P1-T01` — Scaffold Next.js 14 app
- `P1-T02` — GitHub repository setup
- `P1-T03` — Vercel project and domain setup
- `P1-T10` — CI pipeline and secrets scan (single `.github/workflows/ci.yml` file; no data handling, no security decisions — the pipeline itself runs TruffleHog and npm audit as the security layer)
- `P1-T12` — Tailwind CSS + next/font configuration

All other tasks — including engine code, API routes, authentication, security headers, data flows, email handling, constants, and any task touching files with security or permanence implications — must go through the Reviewer. When in doubt, run the Reviewer.

```
You are acting as a senior software architect for RiskHelper.ai.
Read AGENTS.md and SESSIONSTATE.md before responding. Do not proceed until you have confirmed you have read both.
Also read PLANNING.md for the non-negotiable architecture constraints and failure handling rules.
If your task touches security headers, rate limiting, CSRF, email sanitisation, session tokens,
Supabase RLS, Notify Me architecture, or LLM conventions — also read docs/REFERENCE.md before planning.

I need a detailed implementation plan for task [TASK ID] from TASKS.md:

[PASTE THE FULL TASK DESCRIPTION FROM TASKS.md]

The plan must include:
1. A list of every file to create or modify, in the exact order to do the work
2. For each file: what it exports, what it imports, and the key logic it contains
3. Acceptance criteria for each step (objective, pass/fail — not "looks right")
4. Any TypeScript type decisions I need to make
5. Risks: what could go wrong, and how to handle each
6. Any assumption not explicitly covered in the spec or AGENTS.md

Constraints: apply all architecture rules from AGENTS.md (Rules 1–15) and all constraint and
failure handling rules from PLANNING.md. Flag a violation if my request would break any of them.

Do NOT write any code. Produce only the plan.
```

---

## ROLE 2 — Reviewer
*Use Antigravity (Gemini Pro). Run after the Planner. Paste the plan into a new Gemini Pro session.*

### Skip criteria
See Role 1 allowlist above. If the task is on the allowlist, go directly to Role 3.

```
You are a senior code reviewer for a Next.js 14 TypeScript application called RiskHelper.ai.

Read AGENTS.md and PLANNING.md for full project context before reviewing.
For any plan touching security headers, rate limiting, CSRF, email sanitisation, session tokens,
Supabase RLS, Notify Me architecture, or LLM conventions — also read docs/REFERENCE.md.
Do not proceed until you have confirmed you have read the required files.

Review the following implementation plan critically:

[PASTE THE PLAN FROM THE PLANNER HERE]

For each step in the plan, tell me:
1. Security risks? (secret exposure, auth bypass, data in logs, XSS via dangerouslySetInnerHTML,
   email header injection in /api/notify — escapeHtml() required, CSRF on state-mutating routes,
   rate limiting present on /api/assess and /api/notify per AGENTS.md Rule 15)
2. Will this create technical debt in Phase 2, 3.5, or 4?
3. Is the order correct?
4. Are the acceptance criteria objective and sufficient?
5. Anything important missed?

Be direct. If the plan is risky, say so clearly and explain what to change.
```

---

## ROLE 3 — Builder
*Use Antigravity (Claude). Run after plan is reviewed and approved. Implement one step at a time.*

```
You are implementing RiskHelper.ai.
Read AGENTS.md, SESSIONSTATE.md, and PLANNING.md for full project context before beginning.
If this step touches security headers, rate limiting, CSRF, email sanitisation, session tokens,
Supabase RLS, Notify Me architecture, or LLM conventions — also read docs/REFERENCE.md before writing any code.
Do not proceed until you have confirmed you have read the required files.

I have an approved, reviewed implementation plan. I am now working on:

Step [N] of [TOTAL]: [PASTE THE SPECIFIC STEP DESCRIPTION]

Previous steps completed in this task:
[LIST COMPLETED STEPS, OR "None — this is the first step"]

Please implement this step now.

Implementation requirements:
- TypeScript strict mode — no 'any' types, no type assertions unless unavoidable
- Follow the file structure in AGENTS.md exactly
- Do not modify files outside the scope of this step
- If you need to make an assumption, state it explicitly as a comment in the code
- Show the complete file content for every file you create or modify — no partial diffs
- Engine code: no framework dependencies
- Apply all architecture rules from AGENTS.md (Rules 1–15) and all failure handling rules
  from PLANNING.md. If any step would violate a rule, stop and explain rather than proceeding.
```

---

## ROLE 4 — Debugger
*Use Antigravity (Claude). Run when a test fails or a type error cannot be resolved.*

```
You are debugging a failing test or type error in RiskHelper.ai.
Read AGENTS.md and SESSIONSTATE.md for project context.

The failing test or error:
[PASTE THE FULL ERROR OUTPUT]

The relevant code:
[PASTE THE FILE(S) INVOLVED]

The expected behaviour (from TASKS.md acceptance criteria or score.js):
[PASTE THE ACCEPTANCE CRITERION OR score.js BEHAVIOUR]

Diagnose the failure. Is it a bug in the implementation, a wrong test assumption, or a TypeScript
type mismatch? Provide the corrected code and explain why. Do not change the expected output to
match the implementation — if the expectation was derived from score.js, the implementation must
match it.
```

---

## ROLE 5 — Security Reviewer
*Use Antigravity (Claude) AND Antigravity (Gemini Pro) — run both. Compare outputs.*
*Run before any phase ships to production.*

```
You are a security reviewer for RiskHelper.ai — a compliance web application handling user
accounts, payment processing, LLM API calls, and privacy-sensitive assessment data.

Read AGENTS.md and PLANNING.md for full project context before reviewing. These files are the
authoritative source for all security constraints. Do not proceed until you have confirmed you
have read both.

Security context:
- This is a compliance tool. A security or privacy incident would be fatal to the business.
- OWASP Top 10 (Web Applications 2025) applies to all code.
- OWASP Top 10 (LLM Applications 2025) applies to LLM-related code from Phase 3.0.
- PCI DSS compliance required for payment handling (Phase 3.5).

Review the following code for security vulnerabilities:

[PASTE THE CODE TO REVIEW]

Check specifically for:

SECRETS AND DATA EXPOSURE
1. Secret keys that could reach the client bundle — RESEND_API_KEY, KV_REST_API_URL,
   KV_REST_API_TOKEN, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, LLM_API_KEY must never
   have NEXT_PUBLIC_ prefix; hardcoded values; server secrets in client components
2. Assessment answers or personal data logged to Vercel function logs — look for
   console.log/error including request bodies, answer content, or email addresses; production
   logging must use the PLANNING.md Rule 6 pattern
3. Email addresses or subscriber data appearing in production server logs (in /api/notify or
   any future email route)
4. Raw config files returned in API responses (only ResultsObject should be returned from
   the results route)

XSS AND INJECTION
5. User-supplied answer content being interpolated into situationHTML, findings text, or any
   dangerouslySetInnerHTML field — this must never happen; verify the required comment is
   present at every usage site (AGENTS.md Rule 9)
6. Email header injection: user-supplied strings interpolated into Resend email body HTML
   without escapeHtml() from /lib/sanitize.ts — must be applied before use in /api/notify
   (AGENTS.md Rule 13)
7. [For LLM code only] Prompt injection: UserContent branded fields interpolated directly
   into LLM instruction text without <user_input> delimiters

AUTHENTICATION AND ACCESS CONTROL
8. API routes that do not validate input before processing
9. Supabase operations that could bypass row-level security
10. CSRF risk: /api/notify and /api/assess/[slug]/results must validate Origin header using
    the allowedOrigins array pattern from AGENTS.md Rule 12 — includes localhost:3000 in
    non-production. Raw string comparison against NEXT_PUBLIC_APP_URL alone is wrong (breaks
    local dev). Missing check entirely is critical. All Phase 2 state-mutating routes inherit.

RATE LIMITING
11. /api/assess/[slug]/results missing rate limit of 10 req/min per IP via @vercel/kv
    (AGENTS.md Rule 15)
12. /api/notify missing rate limit of 5 req/hr per IP via @vercel/kv (AGENTS.md Rule 15)
13. Rate limit IP extraction uses raw x-forwarded-for header instead of first value after
    split(',')[0].trim() — raw header is a comma-separated list on Vercel (AGENTS.md Rule 15)

SECURITY HEADERS AND TRANSPORT
14. Changes to next.config.js that weaken or remove security headers
15. X-Frame-Options set to SAMEORIGIN instead of DENY — must be DENY to match
    frame-ancestors 'none' in CSP; SAMEORIGIN contradicts the CSP and leaves older browsers
    unprotected (AGENTS.md Rule 10)
16. Google Fonts <link> tags anywhere in the codebase — must use next/font exclusively
17. New third-party service URLs added without updating connect-src in the CSP

FUNCTION CONFIGURATION
18. vercel.json missing maxDuration: 10 for /api/assess/[slug]/results or /api/notify
19. package-lock.json present and committed; npm ci used (not npm install) in CI

ACCESSIBILITY
20. NotifyMeButton success state missing role="status"; error state missing role="alert"

PAYMENTS AND WEBHOOKS (Phase 3.5+)
21. Stripe webhook handlers not verifying the Stripe signature before processing

[For LLM code only — Phase 3.0+]
22. Assessment data sent to the LLM provider without explicit user consent
23. System prompt leakage via user-accessible routes

For each issue found:
- Describe the vulnerability clearly
- Rate its severity: critical / high / medium / low
- Explain how it could be exploited
- Provide the corrected code
```

---

## ROLE 6 — Phase Exit Reviewer
*Use Antigravity (Claude). Run to verify a phase is complete before the next begins.*

```
You are performing a phase exit review for RiskHelper.ai Phase [N].

Read AGENTS.md, SESSIONSTATE.md, and PLANNING.md for full context.

The exit criteria for this phase are:
[PASTE THE PHASE EXIT CRITERIA FROM TASKS.md]

For each criterion:
1. Is the evidence I provide sufficient to mark it complete?
2. Is any evidence incomplete or ambiguous?
3. Which criteria have I not yet provided evidence for?

Do not mark the phase complete unless every criterion is satisfied, including:
- Privacy Policy reviewed by a qualified person and published
- Resend sender address confirmed as support@riskhelper.ai in Resend dashboard
- Breach response runbook exists
- Umami correctly configured (Cloud for Phase 1A)
- Zero answer content in Vercel function logs (verified post-deployment)
- Security headers verified with curl -I in production; X-Frame-Options is DENY
- NotifyMeButton state messages verified with aria role inspection
- Rate limits active: confirmed via /api/assess and /api/notify returning 429 on excess requests
- CSRF protection active: POST to /api/assess and /api/notify with a disallowed Origin returns 403
  (verify with: curl -X POST https://app.riskhelper.ai/api/notify -H "Origin: https://evil.example.com")

Evidence:
[PASTE YOUR EVIDENCE — test output, screenshots, deployed URL, curl output, etc.]
```

---

## UAT script generator
*Use Antigravity (Claude). Run before user acceptance testing of any phase.*

```
Generate a user acceptance test script for Phase [N] of RiskHelper.ai.

The script must cover:
- Each assessment active in this phase
- At minimum 3 different answer combinations per assessment: standard risk, high/elevated risk,
  critical risk
- Mobile browser testing at 375px viewport
- Error conditions: incomplete submissions, browser back/forward navigation, double-submit
- Cookie consent banner:
  - Appears before any analytics fires on first visit
  - Focus moves to banner on appearance (keyboard-only navigation test)
  - Tab stays within banner until choice is made
  - Disappears after choice; does not reappear
  - Verified in private browsing: accept → reopen same private tab → no banner
- Security headers: curl -I https://app.riskhelper.ai shows all five headers
- Font loading: zero requests to fonts.googleapis.com in browser Network tab
- Notify Me form: submits successfully; internal notification email arrives at
  support@riskhelper.ai from support@riskhelper.ai
- Notify Me accessibility: success message announced by screen reader (role="status"); trigger
  error state and verify error announced (role="alert")
- Rate limiting: submit the assessment more than 10 times in under a minute from the same IP;
  verify 429 response is returned and the UI shows a user-friendly error message
- Vercel function logs: submit a test assessment; verify zero answer content in logs
- [Phase 2+] Auth: sign up with 18+ declaration checkbox, log in, password reset, log out
- [Phase 2+] Result saving: result in dashboard after completion, survives log out and back in
- [Phase 2+] Notify Me CAN-SPAM: unsubscribe link in confirmation email; clicking unsubscribe
  shows confirmation page; confirming unsubscribes the record

Format: numbered checklist with expected outcomes. Completable by someone with no technical
background.
```

---

## Session end — save your place
*Use at end of every session.*

```
We are ending this session. Summarise:
1. What we completed today (task IDs and one-line description)
2. Exact state of any in-progress work (what file, what function, what line)
3. The next step in the next session (exact step from the approved plan)
4. Any decisions made that should be added to AGENTS.md
5. Any open questions that must be resolved before work can continue

Format as a handoff note I can paste into SESSIONSTATE.md at the start of the next session.
```

---

## Update AGENTS.md — use when decisions are made

```
I need to update AGENTS.md with a decision that was just made.

Decision: [DESCRIBE THE DECISION]
Context: [WHY IT WAS MADE]
Permanent: [YES / NO — if yes, it cannot be changed without costly refactoring]

Tell me exactly what to add to AGENTS.md and where to add it. Show me the exact text.
```
