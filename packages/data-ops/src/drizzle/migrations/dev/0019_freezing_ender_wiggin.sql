CREATE TABLE "email_whitelist" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_whitelist_email_unique" UNIQUE("email")
);
