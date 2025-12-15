CREATE TABLE "waste_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"city_id" integer NOT NULL,
	"waste_type_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" text NOT NULL,
	"days" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waste_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waste_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "waste_schedules" ADD CONSTRAINT "waste_schedules_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_schedules" ADD CONSTRAINT "waste_schedules_waste_type_id_waste_types_id_fk" FOREIGN KEY ("waste_type_id") REFERENCES "public"."waste_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "waste_schedules_city_id_idx" ON "waste_schedules" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "waste_schedules_waste_type_id_idx" ON "waste_schedules" USING btree ("waste_type_id");--> statement-breakpoint
CREATE INDEX "waste_schedules_year_idx" ON "waste_schedules" USING btree ("year");