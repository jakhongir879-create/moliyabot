// Rollar va ruxsatlar
const ROLE_LABELS = {
  OWNER: "Egasi",
  ACCOUNTANT: "Buxgalter",
  STAFF: "Xodim",
};

const isManager = (role) => role === "OWNER" || role === "ACCOUNTANT";

function permissionsFor(role) {
  const manager = isManager(role);
  return {
    viewBalances: manager,
    viewReports: manager,
    manageDebts: manager,
    manageAccounts: manager,
    manageCategories: manager,
    editTransactions: manager,
    createTransfers: manager,
    manageUsers: role === "OWNER",
    manageSettings: role === "OWNER",
  };
}

const can = (role, permission) => Boolean(permissionsFor(role)[permission]);

module.exports = { ROLE_LABELS, isManager, permissionsFor, can };
