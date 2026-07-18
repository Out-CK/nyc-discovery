# NYC Discovery — Technical Documentation

## Overview

NYC Discovery is a desktop web app that helps users discover restaurants, classes, shows, concerts, and events in New York City through a swipeable card feed with a personalized recommendation engine.

---

## Quick Start

```bash
cd nyc-discovery
npm install
npx prisma generate
npx prisma migrate dev --name init   # creates ./dev.db
npm run seed                          # seeds 300 entities + 100 posts
npm run dev                           # starts at http://localhost:3000
```

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | SQLite via LibSQL + Prisma 7 |
| ORM adapter | `@prisma/adapter-libsql` |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| Icons | Lucide React |

---

## Database Schema

### Entity
The canonical record for any place, venue, class, or event.

| Field | Type | Description |
|---|---|---|
| `id` | cuid | Canonical entity ID |
| `entity_type` | string | restaurant, class, show, concert, party, exhibit, market, fitness, other |
| `canonical_name` | string | Authoritative name (merged across sources) |
| `short_description` | string? | 1–2 sentence summary |
| `full_description` | string? | Full AI-summarized description |
| `tags` | JSON string | Array of AI-generated tags |
| `category_confidence` | float | Model confidence in entity_type classification |
| `neighborhood` | string? | NYC neighborhood name |
| `borough` | string? | Manhattan, Brooklyn, Queens, Bronx, Staten Island |
| `address` | string? | Full street address |
| `lat`, `lng` | float? | Geocoordinates |
| `website` | string? | Official website |
| `phone` | string? | Public phone number |
| `instagram_handle`, `tiktok_handle` | string? | Social handles |
| `business_hours` | JSON string? | `{Monday: "11am–10pm", ...}` |
| `price_level` | int? | 1 (budget) – 4 (splurge) |
| `source_urls` | JSON string | Array of URLs where data was sourced |
| `source_confidence` | float | Overall confidence in sourced data |
| `claim_status` | string | unclaimed, pending, verified |
| `metadata_completeness` | float | 0–1 score used in ranking |
| `has_good_media` | bool | True if high-quality images available |

### Occurrence
A specific event instance or class session tied to an Entity.

| Field | Type | Description |
|---|---|---|
| `id` | cuid | Occurrence ID |
| `entity_id` | cuid | Parent entity |
| `title` | string | Display title (may differ from entity name) |
| `start_time`, `end_time` | DateTime? | Event window |
| `recurrence_rule` | string? | iCal RRULE for recurring events |
| `ticket_url` | string? | Where to buy/register |
| `price` | string? | Free-text price ("$15–$30") |
| `price_cents_min/max` | int? | Machine-readable price range |
| `event_status` | string | scheduled, cancelled, postponed, sold_out |
| `freshness_score` | float | 1.0 = fresh; decays over time |

### Media

| Field | Type | Description |
|---|---|---|
| `entity_id` or `occurrence_id` | cuid? | Parent |
| `media_type` | string | image, video, embed |
| `source_platform` | string | instagram, tiktok, google, yelp, eventbrite, direct |
| `source_url` | string | Original URL |
| `embed_url` | string? | Embed-safe URL (if platform allows) |
| `thumbnail_url` | string? | Lower-res thumbnail |
| `rights_status` | string | linked, embed_allowed, owned, unknown |
| `ranking_score` | float | 0–1, used to surface best media first |
| `is_primary` | bool | Shown as lead image in feed |

### ReviewSummary

| Field | Type | Description |
|---|---|---|
| `review_summary` | string? | AI-generated summary of reviews |
| `sentiment_score` | float? | -1 (negative) to 1 (positive) |
| `review_count` | int | Total reviews across sources |
| `avg_rating` | float? | Weighted average (1–5) |
| `notable_quotes` | JSON string | Array of attributed quotes |
| `source_breakdown` | JSON string | `{google: 120, yelp: 43}` |

### Post
A feed-ready presentation unit shown to users. One entity can have multiple posts (e.g., a restaurant post and a brunch event post).

| Field | Type | Description |
|---|---|---|
| `entity_id` | cuid | Linked entity |
| `occurrence_id` | cuid? | Linked occurrence (if event-specific) |
| `headline` | string | Card title shown in feed |
| `subheadline` | string? | Secondary label |
| `body_markdown` | string? | Full detail content (shown in expanded view) |
| `cta_label` | string | Button text ("Get tickets", "Book a class") |
| `cta_url` | string? | CTA destination |
| `is_active` | bool | Controlled by admin |
| `boost_score` | float | Editorial boost (added to ranking score) |
| `quality_score` | float | Computed 0–1 quality signal |
| `expires_at` | DateTime? | Auto-deactivates after this date |
| `target_neighborhoods` | JSON string | Hint for geo-affinity ranking |
| `target_tags` | JSON string | Hint for tag-affinity ranking |

### UserPreferences (onboarding output)

| Field | Description |
|---|---|
| `neighborhood_prefs` | JSON array of preferred neighborhoods |
| `interest_tags` | JSON array of interest tag strings |
| `price_sensitivity` | 1=budget, 2=moderate, 3=splurge |
| `time_prefs` | JSON array: weekday_evenings, weekends, etc. |
| `indoor_outdoor` | indoor, outdoor, both |
| `solo_or_group` | solo, group, both |

### UserInteraction

| Action | Description |
|---|---|
| `impression` | Post was shown in feed |
| `swipe_left` | User swiped/clicked X |
| `swipe_right` | User liked; entity auto-saved |
| `save` | Explicit bookmark |
| `open_details` | Tapped "Learn more" |
| `outbound_click` | Tapped external link |
| `hide` | Hidden with reason (not_interested, too_far, etc.) |

---

## Data Ingestion Logic

### Source hierarchy (authoritative order)
1. **Official website** — hours, address, phone, schedule
2. **Eventbrite / venue page** — event details, ticket URLs, prices
3. **Google / Maps** — address, phone, hours, ratings (supporting source)
4. **Yelp** — reviews, ratings, photos (supporting source)
5. **Instagram / TikTok** — discovery signals, media; NOT used for authoritative facts

### Entity resolution
Duplicate records across sources are merged using a canonical entity layer:
- Match key: `canonical_name` + `address` + `phone` + `website domain` + `social handles` + geo proximity
- Each source record is preserved in `SourceRecord` linked to the canonical entity
- Conflicts resolved by source confidence ranking (official > aggregator > social)
- If confidence is low, the field is omitted or marked `unknown`

### AI-generated fields
| Field | Method |
|---|---|
| `entity_type` | Multi-class classification from name + description + source URLs |
| `tags` | Keyword extraction + semantic tagging from description, reviews, social content |
| `short_description` / `full_description` | Summarization of web content about the entity |
| `review_summary` | Abstractive summarization of review snippets |
| `sentiment_score` | Sentiment analysis across review sources |
| `category_confidence` | Classification confidence from the entity_type model |

**Policy**: Only generate claims that can be traced to source data. If confidence < 0.5, omit the field or mark it `unknown`.

### Rights and embeds
- We display images via `src` link-out only (`rights_status: "linked"`), with platform attribution
- Official embed codes (YouTube, Instagram oEmbed) may be used where permitted (`rights_status: "embed_allowed"`)
- We never copy or re-host third-party media
- Source URLs are surfaced in the entity detail view for attribution

---

## Ranking Algorithm

The recommendation engine (`src/lib/recommendation.ts`) scores each candidate post for a given user session.

### Score components

| Signal | Max contribution | Description |
|---|---|---|
| **Tag affinity** | 30 pts | Tag overlap between post and user's liked items + onboarding interests. Each matching tag adds 1 pt (capped at 30). |
| **Type affinity** | 20 pts | Boost for entity types the user historically engages with. |
| **Base quality** | 20 pts | `quality_score * 20` — completeness, media, source confidence |
| **Neighborhood match** | 15 pts | +15 if entity is in user's preferred neighborhoods |
| **Recency / time boost** | +20 pts | Events < 48h away get +20; < 7d get +10; past events get −50 |
| **Editorial boost** | 10 pts | `boost_score * 10` — manually set by admins |
| **Metadata completeness** | 10 pts | Reward for complete entity records |
| **Good media** | 5 pts | +5 if `has_good_media = true` |
| **Freshness** | 5 pts | `freshness_score * 5` |
| **Price sensitivity** | −10 pts | Penalty if entity.price_level > user's priceMax |
| **Jitter** | 0–2 pts | Small random noise to prevent identical ordering |

### Diversity rules
- Same entity: suppressed within the same session (impression-based)
- Hard dislike: suppressed for 30 days after swipe_left
- Expired events: always excluded
- Cancelled occurrences: always excluded
- **No more than 2 of the same entity_type in a row** in the final ranked output

### Pagination
The feed loads 20 posts per page. When the user is within 5 posts of the end, the next page is pre-fetched. Pages are offset-based on the scored list.

---

## Claim This Business Flow

1. User clicks "Claim this business" on any entity detail page
2. Submits: name, email, role, relationship, verification method
3. System generates a 4-byte hex verification code
4. In production: code is sent via the chosen method (email to business domain, SMS to business phone, etc.)
5. In dev/MVP: code is shown directly in the UI for testing
6. User enters the code to complete verification
7. `ClaimRequest.status` → `verified`, `Entity.claim_status` → `verified`

---

## Admin Interface

Available at `/admin`. Three tabs:

- **Stats**: KPIs (entity count, post count, users, interactions, saves), entity type breakdown, swipe breakdown, recent activity log
- **Posts**: Paginated list of all posts with toggle (active/inactive), quality score, boost score, interaction count
- **Entities**: Paginated list of all entities with type, neighborhood, metadata completeness, claim status

---

## Known Limitations (v1)

| Area | Limitation |
|---|---|
| **Data freshness** | Seed data is static. No automated ingestion pipeline runs yet. Entities need manual updates or a cron-based refresh job. |
| **Media rights** | All images are linked-out via `<img src>`, not hosted. Some may break if source URLs become invalid. |
| **Geolocation** | Lat/lng is approximated with a ±0.1° random offset from NYC center. Production needs a real geocoding step. |
| **Entity resolution** | Deduplication is done manually in the seed. A real system needs fuzzy name/address matching at ingestion time. |
| **AI classification** | Tags and entity_type for generated entities are template-based, not true ML classification. |
| **Collaborative filtering** | Not yet implemented. The engine currently uses content-based (tag/type affinity) only. |
| **Sessions** | Anonymous, cookie-based. No auth or account persistence across devices. |
| **Claim verification** | Verification codes are shown in the UI (dev mode). Production needs email/SMS/DNS delivery. |
| **Mobile** | Desktop-only MVP. The swipe feed uses mouse drag events; touch support via Framer Motion's pointer events but not fully tuned. |
| **Map view** | Not included in v1. |
| **Social graph** | Not included. |
| **Payments/ticketing** | Not included — outbound links to Eventbrite/venue ticketing only. |
| **Business CMS** | Not included. Claimed businesses can't edit their profile yet. |
| **SQLite in production** | Suitable for MVP/local dev. Production should migrate to PostgreSQL (Prisma schema is compatible; just change the provider and datasource). |

---

## Upgrading to PostgreSQL

1. Change `.env`: `DATABASE_URL="postgresql://user:password@host/db"`
2. Change `prisma.config.ts` datasource `url` accordingly
3. Remove `@libsql/client` and `@prisma/adapter-libsql`; install `@prisma/adapter-pg` or use standard Prisma
4. Update `src/lib/prisma.ts` to use the PG adapter
5. Run `npx prisma migrate deploy`
