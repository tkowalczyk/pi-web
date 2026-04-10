CREATE TABLE "channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"type" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "household_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_role_id_household_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."household_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_sources" ADD CONSTRAINT "notification_sources_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channels_household_id_idx" ON "channels" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "hm_household_id_idx" ON "household_members" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "hm_user_id_idx" ON "household_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ns_household_id_idx" ON "notification_sources" USING btree ("household_id");--> statement-breakpoint
INSERT INTO "household_roles" ("name", "description") VALUES ('admin', 'Full household management access'), ('member', 'Basic household member access');--> statement-breakpoint
INSERT INTO "households" ("name") VALUES ('Dom');