import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { merchantSettingsTable, notificationsTable } from "@workspace/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import {
  AnalyzeRecoveryBody,
  CreateRecoveryActionBody,
  GetAuditQueryParams,
  GetCustomersQueryParams,
  GetPaymentParams,
  GetPaymentsQueryParams,
  GetRecoveryCasesQueryParams,
  GetCustomerParams,
  StopRecoveryParams,
  UpdateSettingsBody,
} from "@workspace/api-zod";

type PaymentStatus =
  | "At Risk"
  | "Analyzing"
  | "Recovery Scheduled"
  | "Retry Pending"
  | "Recovered"
  | "Failed"
  | "Human Review"
  | "Stopped";

type ActionType =
  | "Retry Payment"
  | "Schedule Retry"
  | "Send Payment Reminder"
  | "Offer Alternative Payment Method"
  | "Escalate to Human"
  | "Stop Recovery Attempts";

type CustomerRecord = {
  id: number;
  name: string;
  email: string;
  lifetimeValue: number;
  successfulPayments: number;
  failedPayments: number;
  status: string;
  avatarColor: string;
  lastPaymentAt: string | null;
};

type PaymentRecord = {
  id: number;
  paymentId: string;
  customerId: number;
  amount: number;
  currency: string;
  failureReason: string;
  failedAt: string;
  attempts: number;
  recoveryProbability: number;
  riskLevel: string;
  recommendedAction: ActionType;
  status: PaymentStatus;
  recoveryAttempts: number;
  aiConfidence: number;
  deterministicOutcome: "success" | "failure";
  lastActionAt: string | null;
};

type AiDecisionRecord = {
  id: number;
  paymentId: number;
  recoveryProbability: number;
  recommendedAction: string;
  reasoning: string;
  confidence: number;
  requiresHumanReview: boolean;
  stoppingReason: string | null;
  model: string;
  createdAt: string;
};

type ActionRecord = {
  id: number;
  paymentId: number;
  type: string;
  status: string;
  actor: string;
  reason: string;
  result: string | null;
  scheduledFor: string | null;
  createdAt: string;
  executedAt: string | null;
};

type AuditRecord = {
  id: number;
  timestamp: string;
  eventType: string;
  paymentId: number | null;
  customerName: string;
  actor: string;
  action: string;
  result: string;
  reason: string;
  metadata: Record<string, unknown>;
};

type RecoveryCaseRecord = {
  id: number;
  paymentId: number;
  reason: string;
  recommendation: string;
  confidence: number;
  nextStep: string;
  status: string;
  createdAt: string;
};

type NotificationRecord = {
  id: number;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  href: string | null;
  paymentId: number | null;
  isRead: boolean;
};

const router: IRouter = Router();
const seedTime = new Date("2026-08-31T10:30:00.000Z");
const palette = ["#6857e5", "#1f9d82", "#e79a3b", "#d45c72", "#3b82c4"];
const names = [
  "Aarav Mehta",
  "Ananya Rao",
  "Ishaan Kapoor",
  "Meera Iyer",
  "Rohan Shah",
  "Diya Nair",
  "Kabir Malhotra",
  "Tara Menon",
  "Arjun Bhat",
  "Sana Khan",
  "Vihaan Joshi",
  "Nisha Patel",
  "Aditya Verma",
  "Maya Reddy",
  "Karan Singh",
  "Aditi Bose",
  "Neel Chatterjee",
  "Pihu Das",
  "Yash Kulkarni",
  "Ira Sethi",
];
const failureReasons = [
  "Insufficient funds",
  "Bank timeout",
  "Card expired",
  "Authentication required",
  "Daily limit exceeded",
];
const amounts = [2499, 4999, 1299, 7999, 3499, 999, 6499, 1899, 10999, 2799];

const customers: CustomerRecord[] = names.map((name, index) => ({
  id: index + 1,
  name,
  email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
  lifetimeValue: [28400, 67200, 14800, 93500, 42100][index % 5],
  successfulPayments: 4 + ((index * 3) % 8),
  failedPayments: 1 + (index % 3),
  status: index % 7 === 0 ? "Needs attention" : "Healthy",
  avatarColor: palette[index % palette.length],
  lastPaymentAt: new Date(seedTime.getTime() - (index + 1) * 86400000).toISOString(),
}));

const payments: PaymentRecord[] = Array.from({ length: 50 }, (_, index) => {
  const customerId = (index % 20) + 1;
  const recoveryProbability = [87, 74, 62, 91, 48, 78, 67, 83, 39, 72][index % 10];
  const status: PaymentStatus =
    index < 12
      ? "Recovered"
      : index < 25
        ? "At Risk"
        : index < 32
          ? "Failed"
          : index < 37
            ? "Human Review"
            : index < 42
              ? "Recovery Scheduled"
              : "At Risk";
  const amount = amounts[index % amounts.length];
  const recommendedAction: ActionType =
    recoveryProbability >= 80
      ? "Retry Payment"
      : recoveryProbability >= 65
        ? "Schedule Retry"
        : recoveryProbability >= 50
          ? "Send Payment Reminder"
          : "Escalate to Human";
  return {
    id: index + 1,
    paymentId: `pay_demo_${String(index + 1).padStart(5, "0")}`,
    customerId,
    amount,
    currency: "INR",
    failureReason: failureReasons[index % failureReasons.length],
    failedAt: new Date(seedTime.getTime() - (index + 1) * 9 * 3600000).toISOString(),
    attempts: 1 + (index % 3),
    recoveryProbability,
    riskLevel: recoveryProbability >= 80 ? "Low" : recoveryProbability >= 65 ? "Medium" : "High",
    recommendedAction,
    status,
    recoveryAttempts: index < 12 ? 1 : index % 3 === 0 ? 1 : 0,
    aiConfidence: Math.min(98, recoveryProbability + 7),
    deterministicOutcome: index % 4 === 0 || index % 7 === 0 ? "failure" : "success",
    lastActionAt:
      index < 12
        ? new Date(seedTime.getTime() - (index + 1) * 3600000).toISOString()
        : null,
  };
});

let nextDecisionId = 1;
let nextActionId = 1;
let nextCaseId = 1;
let nextAuditId = 1;
const decisions = new Map<number, AiDecisionRecord>();
const actions: ActionRecord[] = [];
const cases: RecoveryCaseRecord[] = [];
const attempts = new Map<number, Array<{ id: number; attemptedAt: string; result: string; method: string; reason: string }>>();
const audit: AuditRecord[] = [];
const settings = {
  maxAutomatedRetries: 2,
  maxAutomatedAmount: 10000,
  minRecoveryProbability: 70,
  humanApprovalThreshold: 10000,
  automaticRecoveryEnabled: true,
  demoMode: true,
  razorpayConfigured: false,
};

async function hydrateSettings() {
  const rows = await db.select().from(merchantSettingsTable).where(eq(merchantSettingsTable.merchantId, 1)).limit(1);
  const stored = rows[0];
  if (stored) {
    Object.assign(settings, {
      maxAutomatedRetries: stored.maxAutomatedRetries,
      maxAutomatedAmount: Number(stored.maxAutomatedAmount),
      minRecoveryProbability: Number(stored.minRecoveryProbability),
      humanApprovalThreshold: Number(stored.humanApprovalThreshold),
      automaticRecoveryEnabled: stored.automaticRecoveryEnabled,
      demoMode: stored.demoMode,
    });
  } else {
    await db.insert(merchantSettingsTable).values({
      merchantId: 1,
      maxAutomatedRetries: settings.maxAutomatedRetries,
      maxAutomatedAmount: String(settings.maxAutomatedAmount),
      minRecoveryProbability: String(settings.minRecoveryProbability),
      humanApprovalThreshold: String(settings.humanApprovalThreshold),
      automaticRecoveryEnabled: settings.automaticRecoveryEnabled,
      demoMode: settings.demoMode,
    });
  }
  return settings;
}
let notificationsReady = false;

function formatCurrency(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function notificationSeeds() {
  const recoveredPayment = payments.find((payment) => payment.status === "Recovered") ?? payments[0];
  return [
    {
      type: "success",
      title: "Payment recovery succeeded",
      message: `${customerFor(recoveredPayment).name}'s ${formatCurrency(recoveredPayment.amount)} payment was recovered.`,
      timestamp: new Date(seedTime.getTime() - 45 * 60000),
      href: `/payments/${recoveredPayment.id}`,
      paymentId: recoveredPayment.id,
    },
    {
      type: "review",
      title: `${cases.length} payments require human review`,
      message: "Review the cases that crossed your approval threshold.",
      timestamp: new Date(seedTime.getTime() - 2 * 3600000),
      href: "/human-review",
      paymentId: null,
    },
    {
      type: "scan",
      title: "Recovery scan completed",
      message: "The latest scan evaluated eligible payments against merchant guardrails.",
      timestamp: new Date(seedTime.getTime() - 4 * 3600000),
      href: "/recovery",
      paymentId: null,
    },
    {
      type: "warning",
      title: "Payment retry failed",
      message: "A controlled retry did not recover the payment; no further action was taken.",
      timestamp: new Date(seedTime.getTime() - 7 * 3600000),
      href: `/payments/${payments.find((payment) => payment.deterministicOutcome === "failure")?.id ?? payments[0].id}`,
      paymentId: payments.find((payment) => payment.deterministicOutcome === "failure")?.id ?? payments[0].id,
    },
  ];
}

async function ensureNotifications() {
  if (notificationsReady) return;
  const existing = await db.select({ id: notificationsTable.id }).from(notificationsTable).limit(1);
  if (!existing.length) {
    await db.insert(notificationsTable).values(notificationSeeds());
  }
  notificationsReady = true;
}

function publicNotification(row: typeof notificationsTable.$inferSelect): NotificationRecord {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    timestamp: row.timestamp.toISOString(),
    href: row.href,
    paymentId: row.paymentId,
    isRead: Boolean(row.readAt),
  };
}

function isoHoursAgo(hours: number) {
  return new Date(seedTime.getTime() - hours * 3600000).toISOString();
}

function customerFor(payment: PaymentRecord) {
  return customers.find((customer) => customer.id === payment.customerId)!;
}

function publicPayment(payment: PaymentRecord) {
  const customer = customerFor(payment);
  return {
    ...payment,
    customerName: customer.name,
    customerEmail: customer.email,
    avatarColor: customer.avatarColor,
    successfulPayments: customer.successfulPayments,
    lifetimeValue: customer.lifetimeValue,
  };
}

function publicAction(action: ActionRecord) {
  return { ...action };
}

function addAudit(
  payment: PaymentRecord | null,
  eventType: string,
  actor: string,
  action: string,
  result: string,
  reason: string,
  metadata: Record<string, unknown> = {},
) {
  const event: AuditRecord = {
    id: nextAuditId++,
    timestamp: new Date(seedTime.getTime() - (audit.length % 72) * 3600000).toISOString(),
    eventType,
    paymentId: payment?.id ?? null,
    customerName: payment ? customerFor(payment).name : "System",
    actor,
    action,
    result,
    reason,
    metadata,
  };
  audit.unshift(event);
  return event;
}

function safetyChecks(payment: PaymentRecord) {
  return [
    {
      rule: "Automated recovery enabled",
      passed: settings.automaticRecoveryEnabled,
      detail: settings.automaticRecoveryEnabled ? "Merchant automation is enabled" : "Automation is disabled in settings",
    },
    {
      rule: "Under transaction amount limit",
      passed: payment.amount <= settings.maxAutomatedAmount,
      detail:
        payment.amount <= settings.maxAutomatedAmount
          ? `₹${payment.amount.toLocaleString("en-IN")} is within the ₹${settings.maxAutomatedAmount.toLocaleString("en-IN")} limit`
          : `Payment exceeds the ₹${settings.maxAutomatedAmount.toLocaleString("en-IN")} limit`,
    },
    {
      rule: "Recovery probability threshold",
      passed: payment.recoveryProbability >= settings.minRecoveryProbability,
      detail:
        payment.recoveryProbability >= settings.minRecoveryProbability
          ? `${payment.recoveryProbability}% clears the ${settings.minRecoveryProbability}% threshold`
          : `${payment.recoveryProbability}% is below the ${settings.minRecoveryProbability}% threshold`,
    },
    {
      rule: "Retry attempt limit",
      passed: payment.recoveryAttempts < settings.maxAutomatedRetries,
      detail:
        payment.recoveryAttempts < settings.maxAutomatedRetries
          ? `${payment.recoveryAttempts} of ${settings.maxAutomatedRetries} retries used`
          : "Retry limit reached; recovery must stop",
    },
    {
      rule: "Human approval threshold",
      passed: payment.amount < settings.humanApprovalThreshold,
      detail:
        payment.amount < settings.humanApprovalThreshold
          ? "Does not require human approval by amount"
          : "High-value payment requires merchant approval",
    },
  ];
}

function analyze(payment: PaymentRecord) {
  const customer = customerFor(payment);
  const requiresHumanReview =
    payment.amount >= settings.humanApprovalThreshold ||
    payment.recoveryProbability < settings.minRecoveryProbability ||
    payment.recoveryAttempts >= settings.maxAutomatedRetries;
  const stoppingReason =
    payment.recoveryAttempts >= settings.maxAutomatedRetries
      ? "Maximum automated retry attempts reached"
      : payment.amount >= settings.humanApprovalThreshold
        ? "Payment is above the merchant approval threshold"
        : null;
  const action = stoppingReason
    ? payment.recoveryAttempts >= settings.maxAutomatedRetries
      ? "Stop Recovery Attempts"
      : "Escalate to Human"
    : payment.recommendedAction;
  const reasoning =
    payment.failureReason === "Bank timeout"
      ? `This looks temporary. ${customer.name} has completed ${customer.successfulPayments} previous payments successfully, so a retry has a strong chance of recovering the payment.`
      : payment.failureReason === "Insufficient funds"
        ? `The customer has a healthy payment history, but available balance is uncertain. A reminder gives them a chance to resolve the issue without repeated retries.`
        : `The failure needs additional customer context. The recovery plan considers ${payment.attempts} previous attempts, ₹${customer.lifetimeValue.toLocaleString("en-IN")} lifetime value, and the merchant safety limits.`;
  const decision: AiDecisionRecord = {
    id: nextDecisionId++,
    paymentId: payment.id,
    recoveryProbability: payment.recoveryProbability,
    recommendedAction: action,
    reasoning,
    confidence: payment.aiConfidence,
    requiresHumanReview,
    stoppingReason,
    model: "RecoverAI Demo Agent",
    createdAt: new Date(seedTime.getTime() - payment.id * 1800000).toISOString(),
  };
  decisions.set(payment.id, decision);
  payment.status = requiresHumanReview ? "Human Review" : "Analyzing";
  addAudit(payment, "AI recommendation generated", "AI", action, "Recommendation ready", reasoning, {
    probability: decision.recoveryProbability,
    confidence: decision.confidence,
  });
  return decision;
}

function addAction(
  payment: PaymentRecord,
  type: string,
  actor: string,
  reason: string,
  status = "Pending",
) {
  const action: ActionRecord = {
    id: nextActionId++,
    paymentId: payment.id,
    type,
    status,
    actor,
    reason,
    result: null,
    scheduledFor: null,
    createdAt: new Date(seedTime.getTime() - actions.length * 900000).toISOString(),
    executedAt: null,
  };
  actions.unshift(action);
  return action;
}

function executeAction(action: ActionRecord, actor = "System") {
  const payment = payments.find((item) => item.id === action.paymentId);
  if (!payment) throw new Error("Payment not found");
  if (payment.status === "Recovered" || payment.status === "Stopped") {
    throw new Error(`Payment is already ${payment.status.toLowerCase()}`);
  }
  const checks = safetyChecks(payment);
  const automated = action.type === "Retry Payment" || action.type === "Schedule Retry";
  const failedRules = checks.filter((check) => !check.passed);
  if (automated && failedRules.length > 0) {
    action.status = "Blocked";
    action.result = failedRules.map((check) => check.detail).join(". ");
    addAudit(payment, "Safety rule evaluated", "System", action.type, "Blocked", action.result, {
      failedRules: failedRules.map((check) => check.rule),
    });
    return action;
  }
  action.actor = actor;
  action.status = "Executed";
  action.executedAt = new Date(seedTime.getTime() + action.id * 60000).toISOString();
  payment.lastActionAt = action.executedAt;
  if (action.type === "Schedule Retry") {
    action.status = "Scheduled";
    action.scheduledFor = new Date(seedTime.getTime() + 24 * 3600000).toISOString();
    action.result = "Retry scheduled for 24 hours from now";
    payment.status = "Recovery Scheduled";
    addAudit(payment, "Retry scheduled", actor, action.type, "Scheduled", action.result);
  } else if (action.type === "Send Payment Reminder") {
    action.result = "Reminder queued for the customer";
    payment.status = "Retry Pending";
    addAudit(payment, "Reminder sent", actor, action.type, "Queued", action.result);
  } else if (action.type === "Offer Alternative Payment Method") {
    action.result = "Alternative payment method prompt queued";
    payment.status = "Retry Pending";
    addAudit(payment, "Alternative method offered", actor, action.type, "Queued", action.result);
  } else if (action.type === "Escalate to Human") {
    action.result = "Added to merchant review queue";
    payment.status = "Human Review";
    const existingCase = cases.find((item) => item.paymentId === payment.id && item.status === "Pending");
    if (!existingCase) {
      cases.unshift({
        id: nextCaseId++,
        paymentId: payment.id,
        reason: action.reason,
        recommendation: decisions.get(payment.id)?.recommendedAction ?? payment.recommendedAction,
        confidence: payment.aiConfidence,
        nextStep: "Review payment history and approve or reject the recommendation",
        status: "Pending",
        createdAt: action.createdAt,
      });
    }
    addAudit(payment, "Human review requested", actor, action.type, "Queued", action.result);
  } else if (action.type === "Stop Recovery Attempts") {
    action.result = "Recovery attempts stopped by policy";
    payment.status = "Stopped";
    addAudit(payment, "Recovery stopped", actor, action.type, "Stopped", action.result);
  } else {
    payment.recoveryAttempts += 1;
    payment.attempts += 1;
    const result = payment.deterministicOutcome === "success" ? "succeeded" : "failed";
    action.result = `Demo retry ${result}`;
    payment.status = payment.deterministicOutcome === "success" ? "Recovered" : "Failed";
    attempts.set(payment.id, [
      ...(attempts.get(payment.id) ?? []),
      {
        id: payment.recoveryAttempts,
        attemptedAt: action.executedAt,
        result: payment.deterministicOutcome === "success" ? "Success" : "Failed",
        method: "Razorpay Test Mode (simulated)",
        reason: payment.deterministicOutcome === "success" ? "Payment captured in demo processor" : payment.failureReason,
      },
    ]);
    addAudit(payment, "Retry executed", actor, action.type, action.result, "Controlled demo processor returned a deterministic result", {
      processor: "simulated",
      outcome: payment.deterministicOutcome,
    });
  }
  return action;
}

function paymentDetail(payment: PaymentRecord) {
  const customer = customerFor(payment);
  const previousStatus = payment.status;
  const decision = decisions.get(payment.id) ?? analyze(payment);
  if (!["At Risk", "Failed", "Analyzing"].includes(previousStatus)) {
    payment.status = previousStatus;
  }
  const paymentActions = actions.filter((action) => action.paymentId === payment.id).map(publicAction);
  const history = audit.filter((event) => event.paymentId === payment.id);
  const paymentAttempts = attempts.get(payment.id) ?? [
    {
      id: 1,
      attemptedAt: payment.failedAt,
      result: "Failed",
      method: "Razorpay Test Mode (simulated)",
      reason: payment.failureReason,
    },
  ];
  const timeline = [
    {
      timestamp: payment.failedAt,
      title: "Payment failed",
      description: payment.failureReason,
      actor: "Razorpay Test Mode",
      tone: "danger",
    },
    {
      timestamp: decision.createdAt,
      title: "AI analysis completed",
      description: `${decision.recoveryProbability}% recovery probability`,
      actor: "RecoverAI",
      tone: "info",
    },
    ...paymentActions.map((action) => ({
      timestamp: action.executedAt ?? action.createdAt,
      title: action.type,
      description: action.result ?? action.reason,
      actor: action.actor,
      tone: action.status === "Blocked" ? "warning" : action.status === "Executed" ? "success" : "neutral",
    })),
  ];
  return {
    ...publicPayment(payment),
    timeline,
    attemptsHistory: paymentAttempts,
    aiDecision: decision,
    safetyChecks: safetyChecks(payment),
    actions: paymentActions,
    auditHistory: history,
  };
}

function queryValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeStatus(value: string | undefined) {
  if (!value) return undefined;
  const map: Record<string, string> = {
    all: "",
    failed: "Failed",
    recovered: "Recovered",
    in_review: "Human Review",
    pending: "Pending",
    scheduled: "Recovery Scheduled",
    at_risk: "At Risk",
  };
  return map[value.toLowerCase()] ?? value;
}

function dashboard(range = "7d") {
  const atRiskPayments = payments.filter((payment) => !["Recovered", "Stopped"].includes(payment.status));
  const revenueAtRisk = atRiskPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const recovered = payments.filter((payment) => payment.status === "Recovered");
  const revenueRecovered = recovered.reduce((sum, payment) => sum + payment.amount, 0);
  const failed = payments.filter((payment) => payment.status === "Failed");
  const reviewCount = cases.filter((item) => item.status === "Pending").length;
  const trendSets: Record<string, Array<[string, number, number]>> = {
    "7d": [["Aug 26", 18400, 6200], ["Aug 27", 22100, 8400], ["Aug 28", 19700, 11200], ["Aug 29", 25600, 14500], ["Aug 30", 22900, 18100], ["Aug 31", revenueAtRisk, revenueRecovered]],
    "30d": [["Aug 02", 16100, 4900], ["Aug 08", 19800, 7600], ["Aug 14", 22400, 10100], ["Aug 20", 25600, 14500], ["Aug 26", 24100, 18200], ["Aug 31", revenueAtRisk, revenueRecovered]],
    "90d": [["Jun 02", 13200, 3700], ["Jun 20", 17100, 6800], ["Jul 08", 21500, 9800], ["Jul 26", 24800, 14100], ["Aug 14", 27600, 19400], ["Aug 31", revenueAtRisk, revenueRecovered]],
  };
  const trend = (trendSets[range] ?? trendSets["7d"]).map(([label, atRisk, recoveredValue]) => ({ label, atRisk, recovered: recoveredValue }));
  const actionBreakdown = [
    { label: "Retry payment", value: payments.filter((p) => actions.some((a) => a.paymentId === p.id && a.type === "Retry Payment")).length, count: actions.filter((a) => a.type === "Retry Payment").length },
    { label: "Scheduled", value: actions.filter((a) => a.type === "Schedule Retry").reduce((sum, a) => sum + (payments.find((p) => p.id === a.paymentId)?.amount ?? 0), 0), count: actions.filter((a) => a.type === "Schedule Retry").length },
    { label: "Reminders", value: actions.filter((a) => a.type === "Send Payment Reminder").reduce((sum, a) => sum + (payments.find((p) => p.id === a.paymentId)?.amount ?? 0), 0), count: actions.filter((a) => a.type === "Send Payment Reminder").length },
    { label: "Human review", value: cases.reduce((sum, item) => sum + (payments.find((p) => p.id === item.paymentId)?.amount ?? 0), 0), count: cases.length },
  ];
  return {
    metrics: {
      revenueAtRisk,
      revenueRecovered,
      recoveryRate: revenueAtRisk + revenueRecovered === 0 ? 0 : Math.round((revenueRecovered / (revenueAtRisk + revenueRecovered)) * 1000) / 10,
      failedPayments: failed.length,
      customersRecovered: new Set(recovered.map((p) => p.customerId)).size,
      pendingReviews: reviewCount,
      aiActions: actions.filter((a) => a.actor === "AI" || a.actor === "System").length,
      recoveredDelta: 12.4,
      rateDelta: 4.8,
    },
    trend,
    outcomeBreakdown: [
      { label: "Recovered", value: revenueRecovered, count: recovered.length },
      { label: "At risk", value: revenueAtRisk, count: atRiskPayments.length },
      { label: "Failed", value: failed.reduce((sum, payment) => sum + payment.amount, 0), count: failed.length },
    ],
    actionBreakdown,
    recentActivity: audit.slice(0, 8),
  };
}

function analytics(range = "30d") {
  const data = dashboard();
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const cutoff = seedTime.getTime() - days * 86400000;
  const scopedPayments = payments.filter((payment) => new Date(payment.failedAt).getTime() >= cutoff);
  const scopedIds = new Set(scopedPayments.map((payment) => payment.id));
  const eligible = scopedPayments.filter((p) => p.recoveryProbability >= settings.minRecoveryProbability);
  const attempted = scopedPayments.filter((p) => p.recoveryAttempts > 0 || actions.some((a) => a.paymentId === p.id));
  const successful = scopedPayments.filter((p) => p.status === "Recovered");
  const retryActions = actions.filter((a) => a.type === "Retry Payment" && scopedIds.has(a.paymentId));
  const failedRetries = retryActions.filter((a) => a.result?.includes("failed"));
  const revenueRecovered = successful.reduce((sum, p) => sum + p.amount, 0);
  const scopedCases = cases.filter((item) => scopedIds.has(item.paymentId));
  return {
    metrics: {
      revenueAtRisk: data.metrics.revenueAtRisk,
      revenueRecovered,
      recoveryRate: data.metrics.recoveryRate,
      averageRecoveryAmount: successful.length ? Math.round(revenueRecovered / successful.length) : 0,
      successfulRetries: retryActions.filter((a) => a.result?.includes("succeeded")).length,
      failedRetries: failedRetries.length,
    },
    funnel: [
      { label: "At-risk revenue", amount: scopedPayments.reduce((sum, p) => sum + p.amount, 0), count: scopedPayments.length, percent: 100 },
      { label: "Eligible revenue", amount: eligible.reduce((sum, p) => sum + p.amount, 0), count: eligible.length, percent: Math.round((eligible.length / Math.max(scopedPayments.length, 1)) * 100) },
      { label: "Recovery attempted", amount: attempted.reduce((sum, p) => sum + p.amount, 0), count: attempted.length, percent: Math.round((attempted.length / Math.max(scopedPayments.length, 1)) * 100) },
      { label: "Successfully recovered", amount: revenueRecovered, count: successful.length, percent: Math.round((successful.length / Math.max(scopedPayments.length, 1)) * 100) },
    ],
    revenueByAction: [
      { label: "Retry payment", value: revenueRecovered * 0.68, count: retryActions.length },
      { label: "Scheduled retry", value: revenueRecovered * 0.18, count: actions.filter((a) => a.type === "Schedule Retry").length },
      { label: "Human-assisted", value: revenueRecovered * 0.14, count: scopedCases.filter((c) => c.status === "Resolved").length },
    ],
    aiVsHuman: [
      { label: "AI automated", value: revenueRecovered * 0.86, count: successful.length },
      { label: "Merchant assisted", value: revenueRecovered * 0.14, count: scopedCases.filter((c) => c.status === "Resolved").length },
    ],
    retryOutcomes: [
      { label: "Succeeded", value: retryActions.filter((a) => a.result?.includes("succeeded")).length, count: retryActions.filter((a) => a.result?.includes("succeeded")).length },
      { label: "Failed", value: failedRetries.length, count: failedRetries.length },
      { label: "Blocked by safety", value: actions.filter((a) => a.status === "Blocked").length, count: actions.filter((a) => a.status === "Blocked").length },
    ],
  };
}

for (let index = 0; index < 14; index += 1) {
  const payment = payments[index];
  addAudit(payment, "Payment detected", "System", "Payment failure detected", "Recorded", payment.failureReason, {
    paymentId: payment.paymentId,
    amount: payment.amount,
  });
}
for (const payment of payments.filter((item) => item.status === "Recovered").slice(0, 5)) {
  const action = addAction(payment, "Retry Payment", "AI", "High probability and within merchant safety limits", "Executed");
  action.result = "Demo retry succeeded";
  action.executedAt = payment.lastActionAt;
  attempts.set(payment.id, [
    {
      id: 1,
      attemptedAt: payment.lastActionAt ?? payment.failedAt,
      result: "Success",
      method: "Razorpay Test Mode (simulated)",
      reason: "Payment captured in demo processor",
    },
  ]);
}
for (const payment of payments.filter((item) => item.status === "Human Review")) {
  cases.push({
    id: nextCaseId++,
    paymentId: payment.id,
    reason: payment.amount >= settings.humanApprovalThreshold ? "High-value payment requires approval" : "Probability below automatic threshold",
    recommendation: payment.recommendedAction,
    confidence: payment.aiConfidence,
    nextStep: "Review payment history and decide whether to continue recovery",
    status: "Pending",
    createdAt: payment.failedAt,
  });
}

function handleError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected request error";
  res.status(400).json({ error: message });
}

router.get("/dashboard", async (req, res) => {
  try {
    await hydrateSettings();
    return res.json(dashboard(queryValue(req.query.range) ?? "7d"));
  } catch (error) {
    return handleError(res, error);
  }
});

router.get("/payments", (req, res) => {
  try {
    const query = GetPaymentsQueryParams.parse({
      search: queryValue(req.query.search),
      status: queryValue(req.query.status),
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    let result = payments.map(publicPayment);
    const normalizedStatus = normalizeStatus(query.status);
    if (normalizedStatus) result = result.filter((payment) => payment.status === normalizedStatus);
    if (query.search) {
      const search = query.search.toLowerCase();
      result = result.filter((payment) =>
        [payment.customerName, payment.customerEmail, payment.paymentId, payment.failureReason].some((value) =>
          value.toLowerCase().includes(search),
        ),
      );
    }
    res.json(result.slice(0, query.limit ?? 50));
  } catch (error) {
    return handleError(res, error);
  }
});

router.get("/payments/:id", (req, res) => {
  try {
    const { id } = GetPaymentParams.parse({ id: Number(req.params.id) });
    const payment = payments.find((item) => item.id === id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    return res.json(paymentDetail(payment));
  } catch (error) {
    return handleError(res, error);
  }
});

router.get("/customers", (req, res) => {
  try {
    const query = GetCustomersQueryParams.parse({
      search: queryValue(req.query.search),
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    let result = customers;
    if (query.search) {
      const search = query.search.toLowerCase();
      result = result.filter((customer) => `${customer.name} ${customer.email}`.toLowerCase().includes(search));
    }
    res.json(result.slice(0, query.limit ?? 50));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/customers/:id", (req, res) => {
  try {
    const { id } = GetCustomerParams.parse({ id: Number(req.params.id) });
    const customer = customers.find((item) => item.id === id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const customerPayments = payments.filter((payment) => payment.customerId === id);
    return res.json({
      ...customer,
      payments: customerPayments.map(publicPayment),
      recoveryHistory: audit.filter((event) => event.customerName === customer.name),
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get("/recovery/cases", (req, res) => {
  try {
    const query = GetRecoveryCasesQueryParams.parse({ status: queryValue(req.query.status) });
    let result = cases.map((item) => {
      const payment = payments.find((candidate) => candidate.id === item.paymentId)!;
      return {
        id: item.id,
        paymentId: item.paymentId,
        customerName: customerFor(payment).name,
        amount: payment.amount,
        currency: payment.currency,
        reason: item.reason,
        recommendation: item.recommendation,
        confidence: item.confidence,
        previousAttempts: payment.attempts,
        nextStep: item.nextStep,
        status: item.status,
        createdAt: item.createdAt,
      };
    });
    const normalizedStatus = normalizeStatus(query.status);
    if (normalizedStatus) result = result.filter((item) => item.status === normalizedStatus);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/recovery/analyze", (req, res) => {
  try {
    const { paymentId } = AnalyzeRecoveryBody.parse(req.body);
    const payment = payments.find((item) => item.id === paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    return res.json(analyze(payment));
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/recovery/scan", async (_req, res) => {
  try {
    await hydrateSettings();
  const eligible = payments.filter((payment) => ["At Risk", "Failed"].includes(payment.status));
  const events: AuditRecord[] = [];
  let executed = 0;
  let sentToReview = 0;
  let blocked = 0;
  let recoveredRevenue = 0;
  for (const payment of eligible) {
    const decision = analyze(payment);
    events.push(audit[0]);
    if (decision.requiresHumanReview) {
      sentToReview += 1;
      const action = addAction(payment, decision.recommendedAction, "AI", "AI recommendation requires merchant review", "Pending approval");
      if (decision.recommendedAction === "Stop Recovery Attempts") {
        executeAction(action, "System");
      } else if (!cases.some((item) => item.paymentId === payment.id && item.status === "Pending")) {
        cases.unshift({
          id: nextCaseId++,
          paymentId: payment.id,
          reason: decision.stoppingReason ?? "Below automatic recovery threshold",
          recommendation: decision.recommendedAction,
          confidence: decision.confidence,
          nextStep: "Review the recommendation before any action is executed",
          status: "Pending",
          createdAt: action.createdAt,
        });
      }
    } else if (settings.automaticRecoveryEnabled) {
      const action = addAction(payment, decision.recommendedAction, "AI", "Passed deterministic safety validation");
      const executedAction = executeAction(action, "AI");
      if (executedAction.status === "Executed") {
        executed += 1;
        if (payment.status === "Recovered") recoveredRevenue += payment.amount;
      } else if (executedAction.status === "Blocked") {
        blocked += 1;
      }
    } else {
      blocked += 1;
      addAudit(payment, "Safety rule evaluated", "System", decision.recommendedAction, "Blocked", "Automatic recovery is disabled");
    }
  }
  return res.json({
    scanned: eligible.length,
    analyzed: eligible.length,
    executed,
    sentToReview,
    blocked,
    recoveredRevenue,
    events: events.filter(Boolean),
  });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/recovery/actions", (req, res) => {
  try {
    const body = CreateRecoveryActionBody.parse(req.body);
    const payment = payments.find((item) => item.id === body.paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (actions.some((action) => action.paymentId === payment.id && action.type === body.type && ["Pending", "Pending approval", "Scheduled"].includes(action.status))) {
      return res.status(400).json({ error: "A matching recovery action is already pending" });
    }
    const action = addAction(payment, body.type, "Merchant", body.reason ?? "Created by merchant");
    return res.status(201).json(publicAction(action));
  } catch (error) {
    return handleError(res, error);
  }
});

function actionForReviewId(id: number) {
  const reviewCase = cases.find((item) => item.id === id && item.status === "Pending");
  if (reviewCase) {
    const existingForCase = actions.find(
      (item) =>
        item.paymentId === reviewCase.paymentId &&
        ["Pending", "Pending approval", "Approved"].includes(item.status),
    );
    if (existingForCase) return existingForCase;
    const payment = payments.find((item) => item.id === reviewCase.paymentId);
    if (!payment) return undefined;
    return addAction(payment, reviewCase.recommendation, "AI", reviewCase.reason, "Pending approval");
  }
  return actions.find((item) => item.id === id);
}

router.post("/recovery/actions/:id/approve", (req, res) => {
  const action = actionForReviewId(Number(req.params.id));
  if (!action) return res.status(404).json({ error: "Action not found" });
  action.status = "Approved";
  const payment = payments.find((candidate) => candidate.id === action.paymentId);
  addAudit(payment ?? null, "Human approved action", "Merchant", action.type, "Approved", "Merchant approved the recommended recovery action");
  if (payment) executeAction(action, "Merchant");
  const reviewCase = cases.find((item) => item.paymentId === action.paymentId && item.status === "Pending");
  if (reviewCase) reviewCase.status = "Resolved";
  return res.json(publicAction(action));
});

router.post("/recovery/actions/:id/reject", (req, res) => {
  const action = actionForReviewId(Number(req.params.id));
  if (!action) return res.status(404).json({ error: "Action not found" });
  action.status = "Rejected";
  action.result = "Rejected by merchant";
  const payment = payments.find((candidate) => candidate.id === action.paymentId);
  addAudit(payment ?? null, "Human rejected action", "Merchant", action.type, "Rejected", "Merchant rejected the recommended recovery action");
  const reviewCase = cases.find((item) => item.paymentId === action.paymentId && item.status === "Pending");
  if (reviewCase) reviewCase.status = "Rejected";
  return res.json(publicAction(action));
});

router.post("/recovery/actions/:id/execute", (req, res) => {
  try {
    const action = actions.find((item) => item.id === Number(req.params.id));
    if (!action) return res.status(404).json({ error: "Action not found" });
    if (!["Approved", "Pending", "Pending approval"].includes(action.status)) throw new Error("Action must be approved before execution");
    return res.json(publicAction(executeAction(action, "Merchant")));
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/recovery/:id/stop", (req, res) => {
  try {
    const { id } = StopRecoveryParams.parse({ id: Number(req.params.id) });
    const payment = payments.find((item) => item.id === id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    payment.status = "Stopped";
    payment.lastActionAt = new Date(seedTime.getTime() + nextAuditId * 60000).toISOString();
    addAudit(payment, "Recovery stopped", "Merchant", "Stop Recovery Attempts", "Stopped", "Merchant manually stopped recovery");
    return res.json(publicPayment(payment));
  } catch (error) {
    return handleError(res, error);
  }
});

router.get("/analytics", (req, res) => {
  const range = queryValue(req.query.range) ?? "30d";
  res.json(analytics(range));
});

router.get("/audit", (req, res) => {
  try {
    const query = GetAuditQueryParams.parse({
      search: queryValue(req.query.search),
      eventType: queryValue(req.query.eventType),
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    let result = audit;
    if (query.search) {
      const search = query.search.toLowerCase();
      result = result.filter((event) => `${event.customerName} ${event.action} ${event.reason} ${event.result}`.toLowerCase().includes(search));
    }
    if (query.eventType) {
      const eventType = query.eventType.toLowerCase();
      result = result.filter((event) => {
        const value = event.eventType.toLowerCase();
        if (eventType === "payment") return value.includes("payment");
        if (eventType === "recovery") return value.includes("recovery") || value.includes("retry") || value.includes("human") || value.includes("ai");
        if (eventType === "settings") return value.includes("setting");
        return value === eventType;
      });
    }
    res.json(result.slice(0, query.limit ?? 50));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/notifications", async (_req, res) => {
  try {
    await ensureNotifications();
    const rows = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.timestamp));
    res.json(rows.map(publicNotification));
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/notifications/read-all", async (_req, res) => {
  try {
    await ensureNotifications();
    const unread = await db.select({ id: notificationsTable.id }).from(notificationsTable).where(isNull(notificationsTable.readAt));
    if (unread.length) {
      await db.update(notificationsTable).set({ readAt: new Date() }).where(isNull(notificationsTable.readAt));
    }
    res.json({ updated: unread.length });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/notifications/:id/read", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Notification id must be a number" });
    await ensureNotifications();
    await db.update(notificationsTable).set({ readAt: new Date() }).where(eq(notificationsTable.id, id));
    const rows = await db.select().from(notificationsTable).where(eq(notificationsTable.id, id)).limit(1);
    if (!rows[0]) return res.status(404).json({ error: "Notification not found" });
    return res.json(publicNotification(rows[0]));
  } catch (error) {
    return handleError(res, error);
  }
});

router.get("/settings", async (_req, res) => {
  try {
    await hydrateSettings();
    return res.json(settings);
  } catch (error) {
    return handleError(res, error);
  }
});

router.put("/settings", async (req, res) => {
  try {
    await hydrateSettings();
    const update = UpdateSettingsBody.parse(req.body);
    Object.assign(settings, update);
    await db.update(merchantSettingsTable).set({
      maxAutomatedRetries: settings.maxAutomatedRetries,
      maxAutomatedAmount: String(settings.maxAutomatedAmount),
      minRecoveryProbability: String(settings.minRecoveryProbability),
      humanApprovalThreshold: String(settings.humanApprovalThreshold),
      automaticRecoveryEnabled: settings.automaticRecoveryEnabled,
      demoMode: settings.demoMode,
    }).where(eq(merchantSettingsTable.merchantId, 1));
    addAudit(null, "Safety settings updated", "Merchant", "Update safety controls", "Saved", "Merchant settings were updated", update);
    return res.json(settings);
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;