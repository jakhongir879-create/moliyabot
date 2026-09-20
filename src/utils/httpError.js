// API xatoliklari uchun umumiy sinf
class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

const badRequest = (message, code) => new HttpError(400, message, code);
const unauthorized = (message, code) => new HttpError(401, message, code);
const forbidden = (message, code) => new HttpError(403, message, code);
const notFound = (message = "Topilmadi", code) => new HttpError(404, message, code);
const conflict = (message, code) => new HttpError(409, message, code);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict };
