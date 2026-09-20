// Kiruvchi ma'lumotlarni zod sxemalari bilan tekshirish
const { badRequest } = require("../utils/httpError");

const FIELD_LABELS = {
  amount: "Summa",
  toAmount: "Qabul qilinadigan summa",
  accountId: "Hisob",
  toAccountId: "Qabul qiluvchi hisob",
  categoryId: "Toifa",
  type: "Tur",
  note: "Izoh",
  date: "Sana",
  name: "Nom",
  currency: "Valyuta",
  personName: "Ism",
  phone: "Telefon",
  dueDate: "Muddat",
  password: "Parol",
  from: "Boshlanish sanasi",
  to: "Tugash sanasi",
  period: "Davr",
  role: "Rol",
  status: "Holat",
  initialBalance: "Boshlang'ich qoldiq",
};

function validate(schema, source = "body") {
  return (req, _res, next) => {
    let input = req[source];
    if (source === "query") {
      // Bo'sh qiymatlarni tashlab yuboramiz (?type=&q=)
      input = Object.fromEntries(Object.entries(input || {}).filter(([, v]) => v !== "" && v !== undefined));
    }

    const result = schema.safeParse(input === undefined ? {} : input);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.length ? String(issue.path[issue.path.length - 1]) : "";
      const label = FIELD_LABELS[field] || field;
      const message = issue.code === "custom" && issue.message ? issue.message : `${label || "Ma'lumot"} noto'g'ri kiritilgan`;
      return next(badRequest(message, "VALIDATION"));
    }

    req.valid = req.valid || {};
    req.valid[source] = result.data;
    return next();
  };
}

module.exports = { validate };
