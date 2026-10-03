# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are student organization officers (`org_submitter`) filing and tracking an activity proposal under an academic-term deadline.

Other audiences confirmed by the running product:

- Signatories (`org_adviser`, `dean`, `cdm_reviewer`, `osaar`) who endorse, return, or reject a queued paper.
- OSA / admin (`admin`, `osaar`) who register organizations and signatories and post announcements.

Future design optimizes the officer job first. The other desks exist so the paper process can actually be replaced.

## Product Purpose

APEX (Administrative Portal For Events Exchange) is Mapúa University’s digital pipeline for student activity proposals: draft the Student Activity Application Form (SAAF), optionally reserve school facilities, and move the packet through multi-level signatory routing.

Success: the official SAAF / OSAAR paper process is fully replaced. Officers never dual-run a paper packet and the portal.

## Positioning

A campus-authenticated desk that carries an official SAAF (and optional facility reservation) through named institutional signatories, with vision, core values, PEO, and SDG alignment captured in the same packet. A generic form builder or file store could not truthfully claim that routing or that official field set.

## Operating Context

- Officers sign in with Mapúa Cognito, land on their organization dashboard, start a proposal (event name + whether facilities will be reserved), complete the SAAF, optionally complete a reservation, then track signatory routing.
- Signatories work a review queue: approve, return for revision, or reject.
- Admin maintains organizations and people and posts announcements.
- Work happens in a browser on campus or personal devices during an academic term (UI copy currently shows 2026–2027).
- Domain language that users already speak: SAAF, OSAAR, PEO, SDG, co-curricular, extra-curricular, signatory.

## Capabilities and Constraints

Confirmed in the running product:

- Authenticated SPA (AWS Cognito OIDC). Access is gated by Cognito groups.
- Org officers: dashboard, new proposal, SAAF, facility reservation when elected, submission tracker.
- Signatories: review queue and approve / return / reject.
- Admin: organization and signatory records (including CSV import), announcements, submission overview.

Constraints:

- Official SAAF and reservation fields, and the JSON sent to the backend, stay frozen unless the user explicitly changes them.
- Cognito roles stay the access model.
- Name, institution, and domain terminology in Brand Commitments stay.

Undecided (do not invent):

- No product-wide accessibility standard was confirmed.
- No required institutional voice beyond the terminology above.
- No official OSA throughput, SLA, or endorsement claims are on record.

## Brand Commitments

- Product name: **APEX**. Expansion: Administrative Portal For Events Exchange.
- Institution: **Mapúa University**.
- Keep Mapúa / SAAF / OSAAR / PEO / SDG terminology in the product language.

## Evidence on Hand

- In-product About copy describing the SAAF-to-routing pipeline and institutional alignment.
- Team photos under `src/assets/`.
- The live authenticated app and its routes.

Do not fabricate testimonials, approval-time metrics, press, or official OSA endorsement beyond what the product already states.

## Product Principles

1. Replace paper completely — a finished officer flow should not require a parallel packet.
2. Design the officer’s filing job first; signatory and admin desks complete the replacement.
3. Preserve the official field set, API contracts, and Cognito roles.
4. Speak the campus’s terms (SAAF, signatory, PEO, SDG) rather than generic SaaS labels.
