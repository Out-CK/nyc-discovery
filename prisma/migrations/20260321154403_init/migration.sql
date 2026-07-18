-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "canonical_name" TEXT NOT NULL,
    "short_description" TEXT,
    "full_description" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "category_confidence" REAL NOT NULL DEFAULT 1.0,
    "neighborhood" TEXT,
    "borough" TEXT,
    "address" TEXT,
    "lat" REAL,
    "lng" REAL,
    "website" TEXT,
    "phone" TEXT,
    "instagram_handle" TEXT,
    "tiktok_handle" TEXT,
    "business_hours" TEXT,
    "price_level" INTEGER,
    "is_permanently_closed" BOOLEAN NOT NULL DEFAULT false,
    "source_urls" TEXT NOT NULL DEFAULT '[]',
    "source_confidence" REAL NOT NULL DEFAULT 0.5,
    "claim_status" TEXT NOT NULL DEFAULT 'unclaimed',
    "metadata_completeness" REAL NOT NULL DEFAULT 0.0,
    "has_good_media" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Occurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_time" DATETIME,
    "end_time" DATETIME,
    "recurrence_rule" TEXT,
    "ticket_url" TEXT,
    "price" TEXT,
    "price_cents_min" INTEGER,
    "price_cents_max" INTEGER,
    "capacity" INTEGER,
    "event_status" TEXT NOT NULL DEFAULT 'scheduled',
    "freshness_score" REAL NOT NULL DEFAULT 1.0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Occurrence_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_id" TEXT,
    "occurrence_id" TEXT,
    "media_type" TEXT NOT NULL,
    "source_platform" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "embed_url" TEXT,
    "thumbnail_url" TEXT,
    "alt_text" TEXT,
    "rights_status" TEXT NOT NULL DEFAULT 'linked',
    "ranking_score" REAL NOT NULL DEFAULT 0.5,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Media_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Media_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "Occurrence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_id" TEXT NOT NULL,
    "review_summary" TEXT,
    "sentiment_score" REAL,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "avg_rating" REAL,
    "notable_quotes" TEXT NOT NULL DEFAULT '[]',
    "source_breakdown" TEXT NOT NULL DEFAULT '{}',
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ReviewSummary_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platform_id" TEXT,
    "raw_url" TEXT,
    "raw_name" TEXT,
    "raw_address" TEXT,
    "raw_data" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceRecord_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_id" TEXT NOT NULL,
    "occurrence_id" TEXT,
    "headline" TEXT NOT NULL,
    "subheadline" TEXT,
    "body_markdown" TEXT,
    "cta_label" TEXT NOT NULL DEFAULT 'Learn more',
    "cta_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "boost_score" REAL NOT NULL DEFAULT 0.0,
    "quality_score" REAL NOT NULL DEFAULT 0.5,
    "expires_at" DATETIME,
    "target_neighborhoods" TEXT NOT NULL DEFAULT '[]',
    "target_tags" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Post_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Post_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "Occurrence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "display_name" TEXT,
    "session_token" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "neighborhood_prefs" TEXT NOT NULL DEFAULT '[]',
    "interest_tags" TEXT NOT NULL DEFAULT '[]',
    "price_sensitivity" INTEGER NOT NULL DEFAULT 2,
    "time_prefs" TEXT NOT NULL DEFAULT '[]',
    "indoor_outdoor" TEXT NOT NULL DEFAULT 'both',
    "solo_or_group" TEXT NOT NULL DEFAULT 'both',
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "UserPreferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserInteraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "entity_id" TEXT,
    "occurrence_id" TEXT,
    "post_id" TEXT,
    "action" TEXT NOT NULL,
    "hide_type" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" TEXT,
    CONSTRAINT "UserInteraction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserInteraction_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserInteraction_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "Occurrence" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserInteraction_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'general',
    "note" TEXT,
    "saved_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedItem_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedItem_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "submitter_name" TEXT NOT NULL,
    "submitter_email" TEXT NOT NULL,
    "submitter_role" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "verification_method" TEXT,
    "verification_code" TEXT,
    "verification_sent_at" DATETIME,
    "verified_at" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ClaimRequest_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClaimRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewSummary_entity_id_key" ON "ReviewSummary"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_session_token_key" ON "User"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_user_id_key" ON "UserPreferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_user_id_entity_id_key" ON "SavedItem"("user_id", "entity_id");
