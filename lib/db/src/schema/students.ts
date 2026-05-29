import { pgTable, text, serial, timestamp, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  circleId: integer("circle_id"),
  phone: text("phone"),
  country: text("country"),
  ageRange: text("age_range"),
  educationLevel: text("education_level"),
  memorizeFrom: text("memorize_from"),
  extraData: text("extra_data"),
  isArchived: boolean("is_archived").notNull().default(false),
  isNewcomer: boolean("is_newcomer").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  leaveStart: text("leave_start"),
  leaveEnd: text("leave_end"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;

export const studentTransfersTable = pgTable("student_transfers", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  fromCircleId: integer("from_circle_id"),
  toCircleId: integer("to_circle_id").notNull(),
  transferredById: integer("transferred_by_id").notNull(),
  note: text("note"),
  transferredAt: timestamp("transferred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentNotesTable = pgTable("student_notes", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  authorId: integer("author_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentArchiveEventsTable = pgTable("student_archive_events", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  eventType: text("event_type").notNull(), // 'archived' | 'restored'
  circleIdAtTime: integer("circle_id_at_time"),
  performedById: integer("performed_by_id"),
  eventDate: timestamp("event_date", { withTimezone: true }).notNull().defaultNow(),
});

export type StudentArchiveEvent = typeof studentArchiveEventsTable.$inferSelect;

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  targetType: text("target_type").notNull(), // 'student' | 'circle' | 'track'
  targetId: text("target_id").notNull(),     // studentId | circleId | track name
  content: text("content").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
