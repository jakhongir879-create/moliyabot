// API so'rovlari uchun zod sxemalari
const { z } = require("zod");
const config = require("../config/default");
const { PERIODS } = require("../utils/date");

const emptyToUndefined = (v) => (v === "" || v === null ? undefined : v);

const id = z.coerce.number().int().positive();
const optionalId = z.preprocess(emptyToUndefined, id.optional());
const money = z.coerce.number().positive().max(1e13);
const optionalMoney = z.preprocess(emptyToUndefined, money.optional());
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalYmd = z.preprocess(emptyToUndefined, ymd.optional());
const optionalText = (max) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const currency = z.enum(config.currencyCodes);

const txType = z.enum(["INCOME", "EXPENSE", "TRANSFER"]);

const transactionInput = z.object({
  type: txType,
  amount: money,
  accountId: id,
  categoryId: optionalId,
  toAccountId: optionalId,
  toAmount: optionalMoney,
  note: optionalText(300),
  date: optionalText(40),
});

const transactionQuery = z.object({
  type: txType.optional(),
  accountId: optionalId,
  categoryId: optionalId,
  userId: optionalId,
  period: z.enum([...PERIODS, "all"]).optional(),
  from: optionalYmd,
  to: optionalYmd,
  q: optionalText(100),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const accountInput = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(["CASH", "CARD", "BANK", "OTHER"]).default("CASH"),
  currency: currency.default("UZS"),
  initialBalance: z.coerce.number().min(-1e13).max(1e13).default(0),
  icon: optionalText(8),
});

const accountPatch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  type: z.enum(["CASH", "CARD", "BANK", "OTHER"]).optional(),
  initialBalance: z.coerce.number().min(-1e13).max(1e13).optional(),
  icon: optionalText(8),
  isArchived: z.boolean().optional(),
});

const categoryInput = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(["INCOME", "EXPENSE"]),
  icon: optionalText(8),
});

const categoryPatch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  icon: optionalText(8),
  isArchived: z.boolean().optional(),
});

const debtType = z.enum(["RECEIVABLE", "PAYABLE"]);

const debtInput = z.object({
  type: debtType,
  personName: z.string().trim().min(1).max(100),
  phone: optionalText(30),
  amount: money,
  currency,
  dueDate: optionalYmd,
  note: optionalText(300),
  moneyMoved: z.boolean().optional(),
  accountId: optionalId,
});

const debtPatch = z.object({
  personName: z.string().trim().min(1).max(100).optional(),
  phone: z.preprocess((v) => (v === null ? "" : v), z.string().trim().max(30).optional()),
  amount: optionalMoney,
  dueDate: z.preprocess((v) => (v === "" ? null : v), ymd.nullable().optional()),
  note: z.preprocess((v) => (v === null ? "" : v), z.string().trim().max(300).optional()),
});

const debtQuery = z.object({
  type: debtType.optional(),
  status: z.enum(["OPEN", "CLOSED", "ALL"]).optional(),
  q: optionalText(100),
});

const paymentInput = z.object({
  amount: money,
  accountId: id,
  date: optionalText(40),
  note: optionalText(300),
});

const userPatch = z.object({
  role: z.enum(["ACCOUNTANT", "STAFF"]).optional(),
  status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
});

const mePatch = z.object({
  sendReceipts: z.boolean().optional(),
  receiveReports: z.boolean().optional(),
});

const reportQuery = z.object({
  period: z.enum(PERIODS).default("month"),
  from: optionalYmd,
  to: optionalYmd,
});

const exportBody = z.object({
  period: z.enum(PERIODS).default("month"),
  from: optionalYmd,
  to: optionalYmd,
});

const dashboardQuery = z.object({
  days: z.coerce.number().int().min(3).max(90).optional(),
});

const settingsPatch = z.object({
  businessName: z.string().trim().min(1).max(80).optional(),
  notifyOwnerOnStaffEntry: z.boolean().optional(),
  dailyReportEnabled: z.boolean().optional(),
  debtRemindersEnabled: z.boolean().optional(),
  rateAuto: z.boolean().optional(),
  rates: z
    .object({
      USD: optionalMoney,
      EUR: optionalMoney,
      RUB: optionalMoney,
    })
    .optional(),
});

const loginBody = z.object({ password: z.string().min(1).max(200) });

const auditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

module.exports = {
  transactionInput,
  transactionQuery,
  accountInput,
  accountPatch,
  categoryInput,
  categoryPatch,
  debtInput,
  debtPatch,
  debtQuery,
  paymentInput,
  userPatch,
  mePatch,
  reportQuery,
  exportBody,
  dashboardQuery,
  settingsPatch,
  loginBody,
  auditQuery,
};
