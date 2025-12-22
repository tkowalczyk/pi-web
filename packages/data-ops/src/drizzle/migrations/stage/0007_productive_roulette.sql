-- Delete existing waste_schedules data (incompatible with new schema)
DELETE FROM "waste_schedules";--> statement-breakpoint
ALTER TABLE "waste_schedules" ADD COLUMN "street_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "waste_schedules" ADD CONSTRAINT "waste_schedules_street_id_streets_id_fk" FOREIGN KEY ("street_id") REFERENCES "public"."streets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "waste_schedules_street_id_idx" ON "waste_schedules" USING btree ("street_id");