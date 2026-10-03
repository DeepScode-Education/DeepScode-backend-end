// models/TicketCounter.js
//
// Backs the deepScodeYYYYMMDD-XXXX ticket number sequence. One document per
// calendar day (_id = "YYYYMMDD"), incremented atomically via
// findOneAndUpdate + $inc, which MongoDB guarantees is safe under
// concurrent requests — no separate locking needed.
//
// Internal-only model — never exposed through any route/controller.

const mongoose = require("mongoose");

const ticketCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g. "20260826"
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

module.exports = mongoose.model("TicketCounter", ticketCounterSchema);