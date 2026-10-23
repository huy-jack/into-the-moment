import { boolean, integer, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { BodyCheck, Box, IdentityKit, JobOptions } from '../types';

// Spec section 6. All job state lives here: the job runner keeps run data only 1 day on Hobby.

export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  status: text('status').notNull().default('queued'), // queued | running | done | failed
  stage: text('stage').notNull().default('queued'),
  route: text('route'), // adult | child
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  parentJobId: text('parent_job_id'),
  problem: text('problem'),
  input: jsonb('input').$type<{ templatePath: string; userPaths: string[]; kit?: IdentityKit }>().notNull(),
  options: jsonb('options').$type<JobOptions>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const photos = pgTable('photos', {
  id: serial('id').primaryKey(),
  jobId: text('job_id')
    .notNull()
    .references(() => jobs.id),
  kind: text('kind').notNull(), // template | user
  blobPath: text('blob_path').notNull(),
  width: integer('width'),
  height: integer('height'),
  faceBox: jsonb('face_box').$type<Box>(),
  faceSizeRatio: real('face_size_ratio'),
  ageLow: integer('age_low'),
  ageHigh: integer('age_high'),
  personBox: jsonb('person_box').$type<Box>(),
  qualityOk: boolean('quality_ok'),
  qualityReason: text('quality_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const candidates = pgTable('candidates', {
  id: serial('id').primaryKey(),
  jobId: text('job_id')
    .notNull()
    .references(() => jobs.id),
  slot: text('slot').notNull(),
  model: text('model').notNull(),
  attempt: integer('attempt').notNull(),
  blobPath: text('blob_path'),
  identityScore: real('identity_score'),
  bodyCheck: jsonb('body_check').$type<BodyCheck>(),
  repaired: boolean('repaired').notNull().default(false),
  refused: boolean('refused').notNull().default(false),
  refusalText: text('refusal_text'),
  failed: boolean('failed').notNull().default(false),
  rank: integer('rank').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stepCosts = pgTable(
  'step_costs',
  {
    id: serial('id').primaryKey(),
    jobId: text('job_id').notNull(),
    step: text('step').notNull(),
    attempt: integer('attempt').notNull(),
    provider: text('provider').notNull(),
    usd: real('usd').notNull(),
    ms: integer('ms').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('step_costs_job_step_attempt').on(t.jobId, t.step, t.attempt)],
);
