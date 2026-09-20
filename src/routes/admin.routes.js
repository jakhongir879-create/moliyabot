// Admin Panel uchun API yo'llari: /api/admin/*  (faqat localhost, parol + JWT)
const express = require("express");
const rateLimit = require("express-rate-limit");
const a = require("../controllers/adminController");
const c = require("../controllers/clientController");
const { localOnly, adminAuth } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const s = require("../validators/schemas");

const router = express.Router();

router.use(localOnly);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Juda ko'p urinish. 15 daqiqadan so'ng qayta urinib ko'ring.", code: "TOO_MANY_ATTEMPTS" },
});

router.post("/login", loginLimiter, validate(s.loginBody), a.login);

router.use(adminAuth);

router.get("/me", a.me);
router.get("/meta", a.meta);
router.get("/system", a.system);
router.get("/dashboard", validate(s.dashboardQuery, "query"), c.dashboard);

router.get("/settings", a.getSettings);
router.put("/settings", validate(s.settingsPatch), a.updateSettings);
router.get("/audit", validate(s.auditQuery, "query"), a.auditLog);
router.get("/export", validate(s.transactionQuery, "query"), a.downloadExport);

// Operatsiyalar
router.get("/transactions", validate(s.transactionQuery, "query"), c.listTransactions);
router.post("/transactions", validate(s.transactionInput), c.createTransaction);
router.put("/transactions/:id", validate(s.transactionInput), c.updateTransaction);
router.delete("/transactions/:id", c.deleteTransaction);

// Hisoblar
router.get("/accounts", c.listAccounts);
router.post("/accounts", validate(s.accountInput), c.createAccount);
router.patch("/accounts/:id", validate(s.accountPatch), c.updateAccount);
router.delete("/accounts/:id", c.deleteAccount);

// Toifalar
router.get("/categories", c.listCategories);
router.post("/categories", validate(s.categoryInput), c.createCategory);
router.patch("/categories/:id", validate(s.categoryPatch), c.updateCategory);
router.delete("/categories/:id", c.deleteCategory);

// Qarzlar
router.get("/debts", validate(s.debtQuery, "query"), c.listDebts);
router.post("/debts", validate(s.debtInput), c.createDebt);
router.get("/debts/:id", c.getDebt);
router.patch("/debts/:id", validate(s.debtPatch), c.updateDebt);
router.delete("/debts/:id", c.deleteDebt);
router.post("/debts/:id/payments", validate(s.paymentInput), c.addDebtPayment);
router.delete("/debts/:id/payments/:paymentId", c.removeDebtPayment);

// Hisobotlar
router.get("/reports", validate(s.reportQuery, "query"), c.report);

// Foydalanuvchilar
router.get("/users", c.listUsers);
router.patch("/users/:id", validate(s.userPatch), c.updateUser);

module.exports = router;
