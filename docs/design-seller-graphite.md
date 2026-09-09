# Seller summary · Graphite / brand green

Scope: `/app` only. Other `/app/*` routes keep their previous shell. The original CRM design studio stays at `/preview/crm`.

Base revision before this change: `2ede1c0`. Revert the commit introducing this document to restore the previous summary and shell. Do not reset the repository or revert unrelated later work.

## Design

- Graphite surfaces `#1d2224` and `#262c2e`, sidebar `#171c1e`.
- Green `#60b838` sampled from the brighter part of the existing VERDE logo gradient. Small accent text uses `#9ad782` for contrast; body text `#eeeee7`, supporting text `#b0b7b5`.
- Existing logo kept intact on a light inset to preserve its dark lettering.
- Sidebar navigation, flatter statistics, compact reputation gauge, impact rows, commercial overview and activity lists.
- Seller identifiers remain available inside the account-details disclosure.
- Orange/red/yellow meanings retained for reputation; brand green is not substituted for risk colors.

## Behavior preserved

Existing authentication, admin checks, seller selection POST, ML connection flow, API calls and database reads are unchanged. Graphite is an opt-in SellerSwitcher variant; existing uses retain their default rendering. No WhatsApp or worker changes.

Missing account or mediation responses now display unavailable values instead of a misleading zero total. No new calculation of business metrics was introduced.

## Verification

- ESLint and TypeScript checks for changed code.
- Local synthetic fixture exercised both admin and seller menus; fixture removed before publication.
- Desktop and iPhone-width rendering checked, including mobile menu and horizontal bounds.
- Existing production account indicators recorded for comparison after deployment, without changing the active seller or any records.
- Deployment verification must include the live summary, selector, details disclosure and mobile layout.
