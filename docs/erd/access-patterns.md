# mapua-apex — DynamoDB Access Patterns

DynamoDB is modeled around **access patterns**, not normalized relations: every
query is designed first, then the partition key (PK), sort key (SK), and global
secondary indexes (GSI) are chosen to serve it. All patterns hit a **single
table**. There are no joins — related IDs are copied onto items at write time.

Index summary:

| Index | Key | On | Purpose |
|---|---|---|---|
| Base table | `PK` / `SK` | all items | Primary access |
| GSI1 | `GSI1PK` / `GSI1SK` | EVENT, SUBMISSION | Org-scoped event list & admin submission list |
| GSI2 | `GSI2PK` / `GSI2SK` | SUBMISSION | Sparse signatory inbox (`pending` / `returned`) |
| GSI4 | `GSI4PK` / `GSI4SK` | SIGNATORY | Role directory (`ROLE#...`) |

---

## Core access patterns

| # | Access pattern | Operation | Key condition | Index |
|---|---|---|---|---|
| 1 | Org event list (student dashboard) | Query | `GSI1PK = ORGANIZATION#id`, `GSI1SK` desc (first 25 EVENT items) | GSI1 |
| 2 | Event children (its submissions) | Query | `PK = EVENT#id`, `SK` begins `SUBMISSION#` | Base |
| 3 | Student's own submissions | Query | GSI1 for org, then each event partition | GSI1 + Base |
| 4 | Collaboration submissions (dependent view) | Query | `PK = ORGANIZATION#<dep>`, `SK` begins `COLLAB#`, then resolve each pointer to its master SUBMISSION | Base |
| 5 | Single submission detail | GetItem | `PK = EVENT#id`, `SK = SUBMISSION#id` | Base |
| 6 | Submission timeline / audit | Query | `PK = SUBMISSION#id`, `SK` begins `NOTIFICATION#` | Base |
| 7 | Signatory inbox (desk queue) | Query | `GSI2PK = SIGNATORY#id`, `GSI2SK` by time (sparse) | GSI2 |
| 8 | Signatory directory by role | Query | `GSI4PK = ROLE#...`, `GSI4SK` begins `SIGNATORY#` | GSI4 |
| 9 | Current signatory profile (`/signatories/me`) | GetItem | `PK = SIGNATORY#id`, `SK = SIGNATORY#id` | Base |
| 10 | Admin: all submissions | Query | per org `GSI1PK = ORGANIZATION#id`, `GSI1SK` begins `SUBMISSION#` | GSI1 |
| 11 | Student org record (`/students/organization`) | GetItem | `PK = ORGANIZATION#id`, `SK = ORGANIZATION#id` | Base |
| 12 | Org directory (`/students/organizations`) | Query | org list → `{ organization_id, name }` | Base |
| 13 | Announcement list | Query | `PK = ANNOUNCEMENT`, `SK` desc (newest first) | Base |
| 14 | Announcement show / edit / delete | GetItem / PutItem / DeleteItem | `PK = ANNOUNCEMENT`, `SK = timestamp` | Base |
| 15 | Write submission (+ collab pointers) | PutItem | `PK = EVENT#id`, `SK = SUBMISSION#id`; maintain one COLLAB pointer per dependent | Base |
| 16 | Approve / return / deny | UpdateItem | advance `current_signatory` / `GSI2PK` from stored `signatory_sequence`; write NOTIFICATION | Base |

---

## Page / feature → objects accessed

| Page / feature | Objects read or written | Patterns |
|---|---|---|
| Student dashboard | ORGANIZATION, EVENT, SUBMISSION, ANNOUNCEMENT, COLLAB POINTER | 1, 2, 3, 4, 11, 13 |
| Submission tracker / detail | SUBMISSION, NOTIFICATION, SIGNATORY (by copied id) | 5, 6 |
| New / edit submission (SAAF) | SUBMISSION, COLLAB POINTER, ORGANIZATION (directory) | 12, 15 |
| Signatory desk (inbox) | SUBMISSION, SIGNATORY | 7, 9 |
| Signatory review (approve/return/deny/classify) | SUBMISSION, NOTIFICATION | 6, 16 |
| Admin dashboard (submissions) | ORGANIZATION, SUBMISSION | 10 |
| Admin → Organizations | ORGANIZATION, SIGNATORY | 11, 12 |
| Admin → Signatories | SIGNATORY | 8 |
| About / Announcements | ANNOUNCEMENT | 13, 14 |
