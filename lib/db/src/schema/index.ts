import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const merchantsTable = pgTable("merchants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerUserId: integer("owner_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").references(() => merchantsTable.id).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  lifetimeValue: numeric("lifetime_value", { precision: 12, scale: 2 }).notNull(),
  successfulPayments: integer("successful_payments").default(0).notNull(),
  failedPayments: integer("failed_payments").default(0).notNull(),
  status: text("status").notNull(),
  avatarColor: text("avatar_color").notNull(),
  lastPaymentAt: timestamp("last_payment_at"),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").references(() => merchantsTable.id).notNull(),
  customerId: integer("customer_id").references(() => customersTable.id).notNull(),
  paymentId: text("payment_id").notNull().unique(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("INR").notNull(),
  failureReason: text("failure_reason").notNull(),
  failedAt: timestamp("failed_at").notNull(),
  attempts: integer("attempts").default(1).notNull(),
  recoveryAttempts: integer("recovery_attempts").default(0).notNull(),
  recoveryProbability: numeric("recovery_probability", { precision: 5, scale: 2 }).notNull(),
  riskLevel: text("risk_level").notNull(),
  recommendedAction: text("recommended_action").notNull(),
  status: text("status").notNull(),
  deterministicOutcome: text("deterministic_outcome").notNull(),
  lastActionAt: timestamp("last_action_at"),
});

export const paymentAttemptsTable = pgTable("payment_attempts", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").references(() => paymentsTable.id).notNull(),
  attemptedAt: timestamp("attempted_at").notNull(),
  result: text("result").notNull(),
  method: text("method").notNull(),
  reason: text("reason").notNull(),
});

export const recoveryCasesTable = pgTable("recovery_cases", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").references(() => paymentsTable.id).notNull(),
  reason: text("reason").notNull(),
  recommendation: text("recommendation").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
  nextStep: text("next_step").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiDecisionsTable = pgTable("ai_decisions", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").references(() => paymentsTable.id).notNull(),
  recoveryProbability: numeric("recovery_probability", { precision: 5, scale: 2 }).notNull(),
  recommendedAction: text("recommended_action").notNull(),
  reasoning: text("reasoning").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
  requiresHumanReview: boolean("requires_human_review").notNull(),
  stoppingReason: text("stopping_reason"),
  model: text("model").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recoveryActionsTable = pgTable("recovery_actions", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").references(() => paymentsTable.id).notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  actor: text("actor").notNull(),
  reason: text("reason").notNull(),
  result: text("result"),
  scheduledFor: timestamp("scheduled_for"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  executedAt: timestamp("executed_at"),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").references(() => merchantsTable.id).notNull(),
  paymentId: integer("payment_id").references(() => paymentsTable.id),
  customerName: text("customer_name").notNull(),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  result: text("result").notNull(),
  reason: text("reason").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const merchantSettingsTable = pgTable("merchant_settings", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").references(() => merchantsTable.id).notNull().unique(),
  maxAutomatedRetries: integer("max_automated_retries").default(2).notNull(),
  maxAutomatedAmount: numeric("max_automated_amount", { precision: 12, scale: 2 }).default("10000").notNull(),
  minRecoveryProbability: numeric("min_recovery_probability", { precision: 5, scale: 2 }).default("70").notNull(),
  humanApprovalThreshold: numeric("human_approval_threshold", { precision: 12, scale: 2 }).default("10000").notNull(),
  automaticRecoveryEnabled: boolean("automatic_recovery_enabled").default(true).notNull(),
  demoMode: boolean("demo_mode").default(true).notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable);
export const insertMerchantSchema = createInsertSchema(merchantsTable);
export const insertCustomerSchema = createInsertSchema(customersTable);
export const insertPaymentSchema = createInsertSchema(paymentsTable);
export const insertPaymentAttemptSchema = createInsertSchema(paymentAttemptsTable);
export const insertRecoveryCaseSchema = createInsertSchema(recoveryCasesTable);
export const insertAiDecisionSchema = createInsertSchema(aiDecisionsTable);
export const insertRecoveryActionSchema = createInsertSchema(recoveryActionsTable);
export const insertAuditLogSchema = createInsertSchema(auditLogsTable);
export const insertMerchantSettingsSchema = createInsertSchema(merchantSettingsTable);

export type User = z.infer<typeof insertUserSchema>;
export type Merchant = z.infer<typeof insertMerchantSchema>;
export type Customer = z.infer<typeof insertCustomerSchema>;
export type Payment = z.infer<typeof insertPaymentSchema>;
export type PaymentAttempt = z.infer<typeof insertPaymentAttemptSchema>;
export type RecoveryCase = z.infer<typeof insertRecoveryCaseSchema>;
export type AiDecision = z.infer<typeof insertAiDecisionSchema>;
export type RecoveryAction = z.infer<typeof insertRecoveryActionSchema>;
export type AuditLog = z.infer<typeof insertAuditLogSchema>;
export type MerchantSettings = z.infer<typeof insertMerchantSettingsSchema>;
