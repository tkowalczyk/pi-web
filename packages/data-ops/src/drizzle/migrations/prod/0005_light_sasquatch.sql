CREATE TABLE "delivery_failures" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"channel" text NOT NULL,
	"error" text NOT NULL,
	"retry_count" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_failures" ADD CONSTRAINT "delivery_failures_source_id_notification_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."notification_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_log" ADD CONSTRAINT "delivery_log_source_id_notification_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."notification_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "df_source_id_idx" ON "delivery_failures" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "df_created_at_idx" ON "delivery_failures" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dl_source_id_idx" ON "delivery_log" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "dl_status_idx" ON "delivery_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dl_created_at_idx" ON "delivery_log" USING btree ("created_at");