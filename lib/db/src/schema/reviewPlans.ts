import { pgTable, text, serial, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type PlanDayEntry = {
  dayNumber: number;
  surahStart: string;
  ayahStart: number;
  surahEnd: string;
  ayahEnd: number;
  pages: number;
  label?: string;
};

export type PlanTheme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgPattern: "dots" | "lines" | "plain" | "diamonds";
  fontStyle: "rounded" | "elegant" | "bold";
};

export const DEFAULT_THEME: PlanTheme = {
  primaryColor: "#a78bdb",
  secondaryColor: "#f3f0fd",
  accentColor: "#5b21b6",
  bgPattern: "plain",
  fontStyle: "rounded",
};

export type PlanSnapshot = {
  cycleCount: number;
  startDate: string;
  endDate: string;
  totalPages: number;
  memorizedUpToSurah?: string;
  memorizedUpToAyah?: number;
  planType: string;
};

export const reviewPlansTable = pgTable("review_plans", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().unique(),
  trackType: text("track_type").notNull(),
  planType: text("plan_type").notNull().default("auto"),
  cycleCount: integer("cycle_count").notNull().default(1),
  totalPages: real("total_pages").notNull(),
  cycleLength: integer("cycle_length").notNull().default(21),
  startDate: text("start_date").notNull(),
  currentCycleStart: text("current_cycle_start").notNull(),
  memorizedUpToSurah: text("memorized_up_to_surah"),
  memorizedUpToAyah: integer("memorized_up_to_ayah"),
  planEntries: jsonb("plan_entries").$type<PlanDayEntry[]>().notNull().default([]),
  theme: jsonb("theme").$type<PlanTheme>().notNull().default(DEFAULT_THEME),
  status: text("status").notNull().default("active"),
  previousPlans: jsonb("previous_plans").$type<PlanSnapshot[]>().notNull().default([]),
  lastEditedById: integer("last_edited_by_id"),
  lastEditedByName: text("last_edited_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReviewPlanSchema = createInsertSchema(reviewPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReviewPlan = z.infer<typeof insertReviewPlanSchema>;
export type ReviewPlan = typeof reviewPlansTable.$inferSelect;
