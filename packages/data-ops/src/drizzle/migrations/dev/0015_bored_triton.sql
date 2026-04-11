DROP TABLE "addresses" CASCADE;--> statement-breakpoint
DROP TABLE "cities" CASCADE;--> statement-breakpoint
DROP TABLE "notification_logs" CASCADE;--> statement-breakpoint
DROP TABLE "notification_preferences" CASCADE;--> statement-breakpoint
DROP TABLE "streets" CASCADE;--> statement-breakpoint
DROP TABLE "waste_schedules" CASCADE;--> statement-breakpoint
DROP TABLE "waste_types" CASCADE;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "timezone" text DEFAULT 'Europe/Warsaw' NOT NULL;