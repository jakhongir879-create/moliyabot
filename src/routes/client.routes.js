// Mini App uchun API yo'llari: /api/client/*
const express = require("express");
const c = require("../controllers/clientController");
const { telegramAuth, requirePermission } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const s = require("../validators/schemas");

const router = express.Router();

router.use(telegramAuth);

router.get("/bootstrap", c.bootstrap);
router.get("/dashboard", validate(s.dashboardQuery, "query"), c.dashboard);

// Operatsiyalar
router.get("/transactions", validate(s.transactionQuery, "query"), c.listTransactions);
router.post("/transactions", validate(s.transactionInput), c.createTransaction);
router.put("/transactions/:id", requirePermission("editTransactions"), validate(s.transactionInput), c.updateTransaction);
router.delete("/transactions/:id", c.deleteTransaction);

// Hisoblar
router.get("/accounts", c.listAccounts);
router.post("/accounts", requirePermission("manageAccounts"), validate(s.accountInput), c.createAccount);
router.patch("/accounts/:id", requirePermission("manageAccounts"), validate(s.accountPatch), c.updateAccount);
router.delete("/accounts/:id", requirePermission("manageAccounts"), c.deleteAccount);

// Toifalar
router.get("/categories", c.listCategories);
router.post("/categories", requirePermission("manageCategories"), validate(s.categoryInput), c.createCategory);
router.patch("/categories/:id", requirePermission("manageCategories"), validate(s.categoryPatch), c.updateCategory);
router.delete("/categories/:id", requirePermission("manageCategories"), c.deleteCategory);

// Qarzlar
router.get("/debts", requirePermission("manageDebts"), validate(s.debtQuery, "query"), c.listDebts);
router.post("/debts", requirePermission("manageDebts"), validate(s.debtInput), c.createDebt);
router.get("/debts/:id", requirePermission("manageDebts"), c.getDebt);
router.patch("/debts/:id", requirePermission("manageDebts"), validate(s.debtPatch), c.updateDebt);
router.delete("/debts/:id", requirePermission("manageDebts"), c.deleteDebt);
router.post("/debts/:id/payments", requirePermission("manageDebts"), validate(s.paymentInput), c.addDebtPayment);
router.delete("/debts/:id/payments/:paymentId", requirePermission("manageDebts"), c.removeDebtPayment);

// Hisobotlar
router.get("/reports", requirePermission("viewReports"), validate(s.reportQuery, "query"), c.report);
router.post("/reports/export", requirePermission("viewReports"), validate(s.exportBody), c.exportToChat);

// Xodimlar (faqat egasi)
router.get("/users", requirePermission("manageUsers"), c.listUsers);
router.patch("/users/:id", requirePermission("manageUsers"), validate(s.userPatch), c.updateUser);

// Profil
router.patch("/me", validate(s.mePatch), c.updateMe);
router.post("/me/onboarded", c.markOnboarded);

module.exports = router;
