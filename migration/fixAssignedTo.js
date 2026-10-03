// migration/fixAssignedTo.js
//
// ONE-TIME migration: populate `assignedToId` (ObjectId) from existing
// `assignedTo` (String, which stores the counsellor's name or email).
//
// RUN ONCE before deploying the new Inquiry.js schema.
// Safe to run multiple times — it skips leads that already have assignedToId set.
//
// USAGE:
//   node migration/fixAssignedTo.js
//
// Requires MONGO_URI in .env (loaded via dotenv).

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const Inquiry = require("../models/Inquiry");
  const User    = require("../models/User");

  // Fetch all leads that have a string assignedTo but no assignedToId
  const leads = await Inquiry.find({
    assignedTo:   { $ne: null },
    assignedToId: null,
  }).select("_id assignedTo");

  console.log(`Found ${leads.length} leads to migrate`);

  let migrated = 0;
  let skipped  = 0;

  for (const lead of leads) {
    const name = (lead.assignedTo || "").trim();
    if (!name) { skipped++; continue; }

    // Try to find a counsellor by fullName (exact, case-insensitive) or email
    const counsellor = await User.findOne({
      role: { $in: ["counsellor", "admin", "super_admin"] },
      $or: [
        { fullName: { $regex: new RegExp(`^${name}$`, "i") } },
        { email:    name.toLowerCase() },
      ],
    }).select("_id fullName");

    if (counsellor) {
      await Inquiry.updateOne(
        { _id: lead._id },
        { assignedToId: counsellor._id }
      );
      migrated++;
      console.log(`✓ ${lead._id} → ${counsellor.fullName}`);
    } else {
      skipped++;
      console.log(`⚠ ${lead._id} — no user found for "${name}"`);
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});