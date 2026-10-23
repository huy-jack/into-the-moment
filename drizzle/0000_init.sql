CREATE TABLE "candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"slot" text NOT NULL,
	"model" text NOT NULL,
	"attempt" integer NOT NULL,
	"blob_path" text,
	"identity_score" real,
	"body_check" jsonb,
	"repaired" boolean DEFAULT false NOT NULL,
	"refused" boolean DEFAULT false NOT NULL,
	"refusal_text" text,
	"failed" boolean DEFAULT false NOT NULL,
	"rank" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'queued' NOT NULL,
	"route" text,
	"error_code" text,
	"error_message" text,
	"parent_job_id" text,
	"problem" text,
	"input" jsonb NOT NULL,
	"options" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"kind" text NOT NULL,
	"blob_path" text NOT NULL,
	"width" integer,
	"height" integer,
	"face_box" jsonb,
	"face_size_ratio" real,
	"age_low" integer,
	"age_high" integer,
	"person_box" jsonb,
	"quality_ok" boolean,
	"quality_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "step_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"step" text NOT NULL,
	"attempt" integer NOT NULL,
	"provider" text NOT NULL,
	"usd" real NOT NULL,
	"ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "step_costs_job_step_attempt" ON "step_costs" USING btree ("job_id","step","attempt");