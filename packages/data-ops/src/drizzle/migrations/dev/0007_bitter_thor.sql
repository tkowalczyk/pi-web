CREATE TABLE "notification_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"address_id" integer NOT NULL,
	"notification_preference_id" integer NOT NULL,
	"waste_type_ids" text NOT NULL,
	"scheduled_date" text NOT NULL,
	"phone_number" text NOT NULL,
	"sms_content" text NOT NULL,
	"status" text NOT NULL,
	"serwer_sms_message_id" text,
	"serwer_sms_status" text,
	"message_parts" integer,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_notification_preference_id_notification_preferences_id_fk" FOREIGN KEY ("notification_preference_id") REFERENCES "public"."notification_preferences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_logs_user_id_idx" ON "notification_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_logs_address_id_idx" ON "notification_logs" USING btree ("address_id");--> statement-breakpoint
CREATE INDEX "notification_logs_scheduled_date_idx" ON "notification_logs" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "notification_logs_status_idx" ON "notification_logs" USING btree ("status");