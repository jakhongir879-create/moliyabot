// Faoliyat jurnali: kim nimani yaratdi, o'zgartirdi yoki o'chirdi
const { prisma } = require("../database/connection");

async function record(actor, action, entity, entityId, details) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor && actor.userId ? actor.userId : null,
        actorName: (actor && actor.name) || "Tizim",
        action,
        entity,
        entityId: entityId || null,
        details: details === undefined ? undefined : JSON.parse(JSON.stringify(details)),
      },
    });
  } catch (err) {
    // Jurnal yozilmasa ham asosiy amal to'xtamasligi kerak
    console.error("Jurnalga yozib bo'lmadi:", err.message);
  }
}

async function list({ limit = 50, offset = 0 } = {}) {
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { id: "desc" }, take: limit, skip: offset }),
    prisma.auditLog.count(),
  ]);
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      actorName: r.actorName,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      details: r.details,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

module.exports = { record, list };
