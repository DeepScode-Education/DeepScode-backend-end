// const mongoose   = require("mongoose");
// const bcrypt     = require("bcryptjs");

// const Inquiry               = require("../models/Inquiry");
// const { LEAD_HEALTH_OPTIONS } = require("../models/Inquiry");
// const LeadFollowUp          = require("../models/LeadFollowUp");
// const LeadTimeline          = require("../models/LeadTimeline");
// const LeadStatusHistory     = require("../models/LeadStatusHistory");
// const LeadAssignmentHistory = require("../models/LeadAssignmentHistory");
// const User                  = require("../models/User");
// const Enrollment            = require("../models/Enrollment");
// const Course                = require("../models/Course");

// const { appendTimeline, logStatusChange, logAssignment }  = require("../utils/timeline");
// const { notify, notifyMany }                              = require("../utils/notify");



// // ── Helpers ────────────────────────────────────────────────────────────────────

// // UPDATED: a counsellor can now see leads that are either assigned to them
// // OR that they personally created (even if not yet assigned, or reassigned
// // to someone else later — they keep visibility into leads they logged).
// // Returns {} for non-counsellor roles (no restriction — admin/super_admin
// // see everything, as before).
// const counsellorScope = (req) => {
//   if (req.user.role === "counsellor") {
//     return {
//       $or: [
//         { assignedToId: req.user.id },
//         { createdBy: req.user.id },
//       ],
//     };
//   }
//   return {};
// };

// // Merges a counsellor-scope $or clause into a query that may already have its
// // own $or (e.g. from a search filter), without one clobbering the other.
// const applyScope = (query, scope) => {
//   if (!scope || Object.keys(scope).length === 0) return query;
//   if (scope.$or) {
//     if (query.$or) {
//       // Combine both $or clauses via $and so search AND scope both apply
//       query.$and = [...(query.$and || []), { $or: query.$or }, { $or: scope.$or }];
//       delete query.$or;
//     } else {
//       query.$or = scope.$or;
//     }
//   } else {
//     Object.assign(query, scope);
//   }
//   return query;
// };

// // Shared filter builder — used by both getAllLeads and getLeadDashboard so
// // stats and the list always reflect the same active filters.
// // const buildLeadFilterQuery = ({ search = "", status = "", course = "", leadHealth = "" } = {}) => {
// //   const query = {};
// //   if (search) {
// //     query.$or = [
// //       { fullName:     { $regex: search, $options: "i" } },
// //       { email:        { $regex: search, $options: "i" } },
// //       { mobileNumber: { $regex: search, $options: "i" } },
// //     ];
// //   }
// //   if (status) query.leadStatus = status;
// //   if (course) query.course = course;
// //   if (leadHealth && LEAD_HEALTH_OPTIONS.includes(leadHealth)) query.leadHealth = leadHealth;
// //   return query;
// // };


// // "today" is a dynamic date-based filter (createdAt within today's calendar
// // day), never persisted as a leadStatus value — recomputed fresh on every
// // request from the current server date.
// const applyStatusFilter = (query, status) => {
//   if (!status) return query;
//   if (status === "today") {
//     const startOfToday = new Date();
//     startOfToday.setHours(0, 0, 0, 0);
//     const startOfTomorrow = new Date(startOfToday);
//     startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
//     query.createdAt = { $gte: startOfToday, $lt: startOfTomorrow };
//   } else {
//     query.leadStatus = status;
//   }
//   return query;
// };

// const buildLeadFilterQuery = ({ search = "", status = "", course = "", leadHealth = "" } = {}) => {
//   const query = {};
//   if (search) {
//     query.$or = [
//       { fullName:     { $regex: search, $options: "i" } },
//       { email:        { $regex: search, $options: "i" } },
//       { mobileNumber: { $regex: search, $options: "i" } },
//     ];
//   }
//   applyStatusFilter(query, status);
//   if (course) query.course = course;
//   if (leadHealth && LEAD_HEALTH_OPTIONS.includes(leadHealth)) query.leadHealth = leadHealth;
//   return query;
// };

// const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// const send = (res, status, success, message, data = undefined, extra = {}) => {
//   const body = { success, message, ...extra };
//   if (data !== undefined) body.data = data;
//   return res.status(status).json(body);
// };

// const isApprover = (role) => role === "admin" || role === "super_admin";

// const MOBILE_REGEX = /^[6-9]\d{9}$/;
// // const VALID_COURSES = ["UiUX", "GraphicDesign", "MotionVFX", "3D", "Marketing", "Data"];

// // Generate a unique 4-digit student ID (same logic as admin.controller)
// const generateUniqueStudentId = async () => {
//   let studentId, exists = true;
//   while (exists) {
//     studentId = String(Math.floor(1000 + Math.random() * 9000));
//     exists = await User.findOne({ studentId });
//   }
//   return studentId;
// };

// // Resolves the course title string saved on a lead to a real Course document
// // (used for the Enrollment record). Falls back to null if no match found —
// // enrollment is still created with the studentId/lead linkage either way.
// // const resolveCourseDoc = async (courseValue) => {
// //   if (!courseValue) return null;
// //   if (isValidId(courseValue)) {
// //     const byId = await Course.findById(courseValue);
// //     if (byId) return byId;
// //   }
// const resolveCourseDoc = async (courseValue) => {
//   if (!courseValue) return null;
//   if (isValidId(courseValue)) return Course.findById(courseValue);
//   return null; // legacy string values already migrated by the migration script
// };

// // Actually performs the student creation + enrollment + lead-conversion.
// // Shared by: (a) admin/super_admin instant conversion, (b) approving a
// // counsellor's pending conversion request.
// //
// // ── UPDATED: Fee-collection counsellor now falls back to the lead's own
// // counsellor (assignedToId) when no explicit fee-collection assignment
// // exists. This means a counsellor who handles and converts their own lead
// // automatically gets fee-collection access to that student — no manual
// // admin assignment required. Manual admin assignment (feeCollectionCounsellorId)
// // still takes priority whenever it has been explicitly set.
// const performConversion = async (lead, actingUser) => {
//   // ── Resolve fee collection counsellor with fallback ────────────────────────
//   // Priority: explicitly assigned fee-collection counsellor (admin override)
//   //         → falls back to the lead's own counsellor (self-handled leads)
//   //         → null if lead was never assigned to anyone
//   const resolvedFeeCollectionCounsellorId =
//     lead.feeCollectionCounsellorId || lead.assignedToId || null;

//   // Existing-account linkage (no new password / studentId needed)
//   // if (lead.email) {
//   //   const existingUser = await User.findOne({ email: lead.email });
//   //   if (existingUser) {
//   //     if (lead.assignedToId && !existingUser.assignedCounsellor) {
//   //       existingUser.assignedCounsellor = lead.assignedToId;
//   //     }
//   //     // UPDATED — use resolved value (with fallback) instead of raw field
//   //     if (resolvedFeeCollectionCounsellorId && !existingUser.feeCollectionCounsellor) {
//   //       existingUser.feeCollectionCounsellor = resolvedFeeCollectionCounsellorId;
//   //     }
//   //     await existingUser.save();


//    if (lead.email) {
//     const existingUser = await User.findOne({ email: lead.email });
//     if (existingUser) {
//       if (lead.assignedToId && !existingUser.assignedCounsellor) {
//         existingUser.assignedCounsellor = lead.assignedToId;
//       }
//       // UPDATED — use resolved value (with fallback) instead of raw field
//       if (resolvedFeeCollectionCounsellorId && !existingUser.feeCollectionCounsellor) {
//         existingUser.feeCollectionCounsellor = resolvedFeeCollectionCounsellorId;
//       }

//       // ── NEW: sync phone number from lead if missing on the student ──
//       if (lead.mobileNumber && !existingUser.phone) {
//         existingUser.phone = lead.mobileNumber;
//       }

//       await existingUser.save();

//       await Inquiry.findByIdAndUpdate(lead._id, {
//         leadStatus:          "converted",
//         convertedStudentId:  existingUser._id,
//         convertedAt:         new Date(),
//         convertedBy:         actingUser.id,
//         "conversionRequest.status":     "approved",
//         "conversionRequest.approvedBy": actingUser.id,
//         "conversionRequest.approvedAt": new Date(),
//       });

//       const courseDoc = await resolveCourseDoc(lead.course);
//       const existingEnrollment = await Enrollment.findOne({
//         student: existingUser._id,
//         ...(courseDoc ? { course: courseDoc._id } : {}),
//       });
//       if (!existingEnrollment && courseDoc) {
//         await Enrollment.create({ student: existingUser._id, course: courseDoc._id });
//       }

//       logStatusChange(lead._id, lead.leadStatus, "converted", actingUser, "Linked to existing account");
//       appendTimeline(lead._id, "converted", `Linked to existing student account (${existingUser.email})`, {}, actingUser);

//       return { studentUserId: existingUser._id, linkedExisting: true };
//     }
//   }

//   // Brand new student account
//   const tempPassword   = lead.mobileNumber || "deepScode@1234";
//   const hashedPassword = await bcrypt.hash(tempPassword, 10);
//   const studentId      = await generateUniqueStudentId();

//   const student = await User.create({
//     fullName:   lead.fullName,
//     email:      lead.email || `${lead.mobileNumber}@deepScodenoemail.local`,
//     password:   hashedPassword,
//     role:       "student",
//     status:     "approved",
//     studentId,
//     isActive:   true,
//     approvedAt: new Date(),
//     createdBy:  actingUser.id,
//     // ── FIX: copy the lead's assigned counsellor onto the new student ──
//      phone: lead.mobileNumber || undefined,
//     assignedCounsellor: lead.assignedToId || null,
//     // UPDATED — falls back to lead's own counsellor when no manual override exists
//     feeCollectionCounsellor: resolvedFeeCollectionCounsellorId,
//   });

//   const courseDoc = await resolveCourseDoc(lead.course);
//   let enrollment = null;
//   if (courseDoc) {
//     enrollment = await Enrollment.create({ student: student._id, course: courseDoc._id });
//   }

//   await Inquiry.findByIdAndUpdate(lead._id, {
//     leadStatus:          "converted",
//     convertedStudentId:  student._id,
//     convertedAt:         new Date(),
//     convertedBy:         actingUser.id,
//     "conversionRequest.status":     "approved",
//     "conversionRequest.approvedBy": actingUser.id,
//     "conversionRequest.approvedAt": new Date(),
//   });

//   logStatusChange(lead._id, lead.leadStatus, "converted", actingUser, "Student account created");
//   appendTimeline(
//     lead._id, "converted",
//     `Converted to student — ID: ${studentId}`,
//     { studentUserId: student._id, studentId, enrollmentId: enrollment?._id || null },
//     actingUser
//   );

//   const admins = await User.find({ role: { $in: ["admin", "super_admin"] }, isActive: true }).select("_id");
//   notifyMany(
//     admins.map((a) => a._id),
//     {
//       type:              "lead_converted",
//       title:             `${lead.fullName} converted to student`,
//       body:              `Student ID: ${studentId}. Course: ${lead.course}.`,
//       link:              `/admin/students/${student._id}`,
//       relatedResource:   "User",
//       relatedResourceId: student._id,
//     }
//   );

//   return {
//     studentUserId: student._id,
//     student: {
//       _id:       student._id,
//       fullName:  student.fullName,
//       email:     student.email,
//       studentId: student.studentId,
//     },
//     enrollmentId: enrollment?._id || null,
//     tempPassword,
//   };
// };

// // ── POST /api/leads ─────────────────────────────────────────────────────────────
// // NEW: unified lead creation for admin/super_admin/counsellor (mirrors the
// // public inquiry form flow but for staff manually logging leads).
// //
// // Counsellor:
// //   - assignedToId / assignedTo are ALWAYS forced to the logged-in counsellor,
// //     regardless of what (if anything) was sent in the body — a counsellor
// //     cannot create a lead and assign it to someone else.
// //   - createdBy / createdByRole are always set from req.user.
// //
// // Admin / Super Admin:
// //   - May optionally provide assignedToId to hand the lead straight to a
// //     counsellor; otherwise it's created unassigned (same as before).
// //   - createdBy / createdByRole are still recorded for audit purposes, but
// //     do NOT restrict their own visibility (admins see everything).
// //
// // leadHealth (NEW): optional at creation. Independent of leadStatus workflow.
// // Defaults to "Untouched" if omitted or invalid.
// const createLead = async (req, res) => {
//   try {
//     const {
//       fullName, mobileNumber, email, course,
//       source, remarks, assignedToId, priority, leadHealth,
//     } = req.body;

//     // ── Validation (mirrors inquiryValidator rules) ───────────────────────────
//     if (!fullName || !fullName.trim()) {
//       return send(res, 422, false, "Full name is required");
//     }
//     if (!mobileNumber || !MOBILE_REGEX.test(mobileNumber.trim())) {
//       return send(res, 422, false, "Enter a valid 10-digit Indian mobile number");
//     }
//     if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
//       return send(res, 422, false, "Enter a valid email address");
//     }
//     // if (!course || !VALID_COURSES.includes(course)) {
//     //   return send(res, 422, false, "Invalid course selected");
//     // }
//     if (!course || !isValidId(course)) {
//   return send(res, 422, false, "Invalid course selected");
// }
// const courseDoc = await Course.findById(course).select("_id title");
// if (!courseDoc) {
//   return send(res, 422, false, "Selected course does not exist");
// }
//     if (leadHealth !== undefined && !LEAD_HEALTH_OPTIONS.includes(leadHealth)) {
//       return send(res, 422, false, "Invalid leadHealth value");
//     }

//     const normalizedEmail = email ? email.toLowerCase().trim() : undefined;

//     // ── Duplicate check (same as public flow, only when email present) ───────
//     if (normalizedEmail) {
//       const existing = await Inquiry.findOne({ email: normalizedEmail, course });
//       if (existing) {
//         return send(res, 409, false, "A lead with this email already applied for this course.");
//       }
//     }

//     const payload = {
//       fullName: fullName.trim(),
//       mobileNumber: mobileNumber.trim(),
//       email: normalizedEmail,
//       course,
//       source: source || "Manual",
//       remarks: remarks || "",
//       priority: priority || "medium",
//       leadHealth: LEAD_HEALTH_OPTIONS.includes(leadHealth) ? leadHealth : "Untouched",
//       createdBy: req.user.id,
//       createdByRole: req.user.role,
//     };

//     if (req.user.role === "counsellor") {
//       // Force self-assignment — a counsellor cannot assign a lead to someone else
//       const counsellor = await User.findById(req.user.id).select("fullName");
//       payload.assignedToId = req.user.id;
//       payload.assignedTo   = counsellor?.fullName || req.user.fullName || null;
//     } else if (assignedToId && isValidId(assignedToId)) {
//       // Admin / super_admin may optionally assign at creation time
//       const counsellor = await User.findById(assignedToId).select("fullName");
//       if (counsellor) {
//         payload.assignedToId = counsellor._id;
//         payload.assignedTo   = counsellor.fullName;
//       }
//     }

//     const lead = await Inquiry.create(payload);

//     appendTimeline(
//       lead._id, "info_updated",
//       `Lead created by ${req.user.fullName || req.user.role}${payload.assignedToId ? ` and assigned to ${payload.assignedTo}` : ""}`,
//       { createdByRole: req.user.role, leadHealth: payload.leadHealth },
//       req.user
//     );

//     if (payload.assignedToId && req.user.role !== "counsellor") {
//       // Admin manually assigned it to a counsellor at creation — notify them
//       notify({
//         userId:            payload.assignedToId,
//         type:              "lead_assigned",
//         title:             "New lead assigned to you",
//         body:              `${lead.fullName} (${lead.course}) has been assigned to you.`,
//         link:              `/counsellor/leads/${lead._id}`,
//         relatedResource:   "Inquiry",
//         relatedResourceId: lead._id,
//       });
//     }

//     return send(res, 201, true, "Lead created successfully", lead);
//   } catch (error) {
//     console.error("createLead error:", error);
//     if (error.code === 11000) return send(res, 409, false, "Duplicate lead detected");
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── GET /api/leads ─────────────────────────────────────────────────────────────
// // const getAllLeads = async (req, res) => {
// //   try {
// //     const {
// //       page = 1, limit = 20, search = "",
// //       status = "", course = "", priority = "",
// //       source = "", assignedToId = "", unassigned = "",
// //       leadHealth = "",
// //     } = req.query;

// //     let query = {};

// //     if (search) {
// //       query.$or = [
// //         { fullName:     { $regex: search, $options: "i" } },
// //         { email:        { $regex: search, $options: "i" } },
// //         { mobileNumber: { $regex: search, $options: "i" } },
// //       ];
// //     }
// //     if (status)      query.leadStatus  = status;
// //     if (course)      query.course      = course;
// //     if (priority)    query.priority    = priority;
// //     if (source)      query.source      = source;
// //     if (leadHealth && LEAD_HEALTH_OPTIONS.includes(leadHealth)) query.leadHealth = leadHealth;
// //     if (assignedToId && isValidId(assignedToId)) query.assignedToId = assignedToId;
// //     if (unassigned === "true") query.assignedToId = null;

// //     // Counsellor scope: leads assigned to them OR created by them.
// //     // Safely merged with the search $or above (if present) via $and.
// //     query = applyScope(query, counsellorScope(req));

// //     const pageNum  = Math.max(1, parseInt(page,  10) || 1);
// //     const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
// //     const skip     = (pageNum - 1) * limitNum;

// //     const total = await Inquiry.countDocuments(query);
// //     const leads = await Inquiry.find(query)
// //       .sort({ priority: -1, createdAt: -1 })
// //       .skip(skip)
// //       .limit(limitNum)
// //       .populate("assignedToId", "fullName email role")
// //       .populate("createdBy", "fullName email role");

// //     return send(res, 200, true, "Leads fetched", leads, {
// //       pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
// //     });
// //   } catch (error) {
// //     console.error("getAllLeads error:", error);
// //     return send(res, 500, false, "Server error");
// //   }
// // };


// const getAllLeads = async (req, res) => {
//   try {
//     const {
//       page = 1, limit = 50, search = "",
//       status = "", course = "", priority = "",
//       source = "", assignedToId = "", unassigned = "",
//       leadHealth = "",
//     } = req.query;

//     let query = buildLeadFilterQuery({ search, status, course, leadHealth });
//     if (priority)    query.priority    = priority;
//     if (source)      query.source      = source;
//     if (assignedToId && isValidId(assignedToId)) query.assignedToId = assignedToId;
//     if (unassigned === "true") query.assignedToId = null;

//     query = applyScope(query, counsellorScope(req));

//     const pageNum  = Math.max(1, parseInt(page,  10) || 1);
//     const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
//     const skip     = (pageNum - 1) * limitNum;

//     const total = await Inquiry.countDocuments(query);
//     const leads = await Inquiry.find(query)
//   .sort({ priority: -1, createdAt: -1 })
//   .skip(skip)
//   .limit(limitNum)
//   .populate("assignedToId", "fullName email role")
//   .populate("createdBy", "fullName email role")
//   .populate("course", "title slug category");

//     return send(res, 200, true, "Leads fetched", leads, {
//       pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
//     });
//   } catch (error) {
//     console.error("getAllLeads error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── GET /api/leads/:id ─────────────────────────────────────────────────────────
// const getLeadById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const filter = applyScope({ _id: id }, counsellorScope(req));
//     const lead = await Inquiry.findOne(filter)
//   .populate("assignedToId", "fullName email role")
//   .populate("createdBy", "fullName email role")
//   .populate("branch", "name code")
//   .populate("convertedStudentId", "fullName email studentId")
//   .populate("conversionRequest.requestedBy", "fullName email role")
//   .populate("conversionRequest.approvedBy", "fullName email role")
//   .populate("conversionRequest.rejectedBy", "fullName email role")
//   .populate("feeHistory.changedBy", "fullName email role")
//   .populate("course", "title slug category");

//     if (!lead) {
//       return send(res, 404, false,
//         req.user.role === "counsellor" ? "Lead not found or not assigned to you" : "Lead not found"
//       );
//     }

//     const followUps = await LeadFollowUp.find({ leadId: id }).sort({ createdAt: -1 });
//     return send(res, 200, true, "Lead fetched", { lead, followUps });
//   } catch (error) {
//     console.error("getLeadById error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── PATCH /api/leads/:id/status ────────────────────────────────────────────────
// // NOTE: leadStatus is the workflow field. leadHealth is intentionally NOT
// // touched here — it's independent and only updated via updateLeadDetails
// // (or a dedicated leadHealth field, see updateLeadInfo below).
// const updateLeadStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { leadStatus, remarks = "" } = req.body;

//     const validStatuses = ["new", "contacted", "interested", "follow-up", "converted", "lost"];
//     if (!validStatuses.includes(leadStatus)) {
//       return send(res, 400, false, "Invalid status");
//     }

//     const filter   = applyScope({ _id: id }, counsellorScope(req));
//     const existing = await Inquiry.findOne(filter);
//     if (!existing) return send(res, 404, false, "Lead not found");

//     const prevStatus = existing.leadStatus;

//     const lead = await Inquiry.findOneAndUpdate(
//       filter,
//       { leadStatus, lastContactedAt: new Date() },
//       { new: true }
//     );

//     if (prevStatus !== leadStatus) {
//       logStatusChange(id, prevStatus, leadStatus, req.user, remarks);
//     }

//     return send(res, 200, true, "Status updated", lead);
//   } catch (error) {
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── PATCH /api/leads/:id/assign ────────────────────────────────────────────────
// // Admin / Super Admin only — enforced at route level (isAdminOrSuper middleware)
// const assignLead = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { assignedTo, assignedToId: newCounsellorId, reason = "" } = req.body;

//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const existing = await Inquiry.findById(id);
//     if (!existing) return send(res, 404, false, "Lead not found");

//     let newCounsellor = null;
//     if (newCounsellorId && isValidId(newCounsellorId)) {
//       newCounsellor = await User.findById(newCounsellorId).select("fullName email role");
//     }

//     const prevCounsellorId = existing.assignedToId;
//     let prevCounsellor = null;
//     if (prevCounsellorId) {
//       prevCounsellor = await User.findById(prevCounsellorId).select("fullName email");
//     }

//     const update = {
//       assignedTo:   newCounsellor?.fullName || assignedTo || null,
//       assignedToId: newCounsellor?._id      || null,
//     };

//     const lead = await Inquiry.findByIdAndUpdate(id, update, { new: true });

//     logAssignment(
//       id,
//       prevCounsellor ? { id: prevCounsellor._id, name: prevCounsellor.fullName } : null,
//       newCounsellor  ? { id: newCounsellor._id,  name: newCounsellor.fullName  } : null,
//       req.user,
//       reason
//     );

//     if (newCounsellor?._id) {
//       notify({
//         userId:            newCounsellor._id,
//         type:              "lead_assigned",
//         title:             "New lead assigned to you",
//         body:              `${lead.fullName} (${lead.course}) has been assigned to you.`,
//         link:              `/counsellor/leads/${lead._id}`,
//         relatedResource:   "Inquiry",
//         relatedResourceId: lead._id,
//       });
//     }

//     return send(res, 200, true, "Lead assigned", lead);
//   } catch (error) {
//     console.error("assignLead error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── PATCH /api/leads/:id/priority ─────────────────────────────────────────────
// const updateLeadPriority = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { priority } = req.body;

//     if (!["low", "medium", "high", "urgent"].includes(priority)) {
//       return send(res, 400, false, "Priority must be low, medium, high, or urgent");
//     }
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const existing = await Inquiry.findOne(applyScope({ _id: id }, counsellorScope(req)));
//     if (!existing) return send(res, 404, false, "Lead not found");

//     const prevPriority = existing.priority;
//     const lead = await Inquiry.findByIdAndUpdate(id, { priority }, { new: true });

//     if (prevPriority !== priority) {
//       appendTimeline(
//         id, "priority_changed",
//         `Priority changed from "${prevPriority}" to "${priority}"`,
//         { from: prevPriority, to: priority },
//         req.user
//       );
//     }

//     return send(res, 200, true, "Priority updated", lead);
//   } catch (error) {
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── PATCH /api/leads/:id/demo ──────────────────────────────────────────────────
// // demoScheduledAt now supports full date+time (datetime-local on the frontend);
// // no backend change needed — Date() already stores time precision.
// const updateDemoInfo = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const {
//       demoScheduledAt, demoMode, demoCompleted,
//       demoFeedback, demoRating,
//     } = req.body;

//     const filter = applyScope({ _id: id }, counsellorScope(req));
//     const update = {};

//     if (demoScheduledAt !== undefined) update.demoScheduledAt = demoScheduledAt ? new Date(demoScheduledAt) : null;
//     if (demoMode        !== undefined) update.demoMode        = demoMode;
//     if (demoFeedback    !== undefined) update.demoFeedback    = demoFeedback;
//     if (demoRating      !== undefined) update.demoRating      = demoRating;

//     if (demoCompleted === true || demoCompleted === "true") {
//       update.demoCompleted    = true;
//       update.demoCompletedAt  = new Date();
//     } else if (demoCompleted === false || demoCompleted === "false") {
//       update.demoCompleted    = false;
//       update.demoCompletedAt  = null;
//     }

//     if (Object.keys(update).length === 0) {
//       return send(res, 400, false, "No demo fields provided");
//     }

//     const lead = await Inquiry.findOneAndUpdate(filter, { $set: update }, { new: true });
//     if (!lead) return send(res, 404, false, "Lead not found");

//     const isCompletion = update.demoCompleted === true;

//     appendTimeline(
//       id,
//       isCompletion ? "demo_completed" : "demo_scheduled",
//       isCompletion
//         ? `Demo completed${demoRating ? ` — rating: ${demoRating}/5` : ""}`
//         : `Demo scheduled for ${new Date(update.demoScheduledAt).toLocaleString("en-IN")} (${demoMode || "mode TBD"})`,
//       update,
//       req.user
//     );

//     return send(res, 200, true, isCompletion ? "Demo marked complete" : "Demo info updated", lead);
//   } catch (error) {
//     console.error("updateDemoInfo error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── PATCH /api/leads/:id/payment-plan ─────────────────────────────────────────
// const updatePaymentPlan = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const {
//       mode, emiMonths, downPayment, notes,
//       negotiatedAmount, originalFee,
//       reason = "", remarks = "",
//     } = req.body;

//     const filter   = applyScope({ _id: id }, counsellorScope(req));
//     const existing = await Inquiry.findOne(filter);
//     if (!existing) return send(res, 404, false, "Lead not found");

//     const update = {};
//     if (mode             !== undefined) update["paymentPlan.mode"]        = mode;
//     if (emiMonths         !== undefined) update["paymentPlan.emiMonths"]   = emiMonths;
//     if (downPayment       !== undefined) update["paymentPlan.downPayment"] = downPayment;
//     if (notes             !== undefined) update["paymentPlan.notes"]      = notes;
//     if (originalFee       !== undefined) update["fees.originalFee"]       = originalFee;

//     let historyEntry = null;
//     if (negotiatedAmount !== undefined) {
//       const prevAmount = existing.fees?.negotiatedAmount ?? null;
//       update["fees.negotiatedAmount"] = negotiatedAmount;

//       if (prevAmount !== negotiatedAmount) {
//         historyEntry = {
//           previousAmount: prevAmount,
//           newAmount:      negotiatedAmount,
//           changedBy:      req.user.id,
//           role:           req.user.role,
//           reason,
//           remarks,
//           createdAt:      new Date(),
//         };
//       }
//     }

//     if (Object.keys(update).length === 0) {
//       return send(res, 400, false, "No payment plan fields provided");
//     }

//     const mongoUpdate = { $set: update };
//     if (historyEntry) {
//       mongoUpdate.$push = { feeHistory: historyEntry };
//     }

//     const lead = await Inquiry.findOneAndUpdate(filter, mongoUpdate, { new: true })
//       .populate("feeHistory.changedBy", "fullName email role");
//     if (!lead) return send(res, 404, false, "Lead not found");

//     appendTimeline(
//       id, "info_updated",
//       historyEntry
//         ? `Fee updated: ₹${historyEntry.previousAmount ?? "—"} → ₹${historyEntry.newAmount}${reason ? ` — ${reason}` : ""}`
//         : "Payment plan updated",
//       update,
//       req.user
//     );

//     return send(res, 200, true, "Payment plan updated", lead);
//   } catch (error) {
//     console.error("updatePaymentPlan error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── PATCH /api/leads/:id/parent-info ──────────────────────────────────────────
// const updateParentInfo = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const { fatherName, motherName, guardianName, guardianMobile } = req.body;
//     const update = {};
//     if (fatherName     !== undefined) update["parentInfo.fatherName"]     = fatherName;
//     if (motherName     !== undefined) update["parentInfo.motherName"]     = motherName;
//     if (guardianName   !== undefined) update["parentInfo.guardianName"]   = guardianName;
//     if (guardianMobile !== undefined) update["parentInfo.guardianMobile"] = guardianMobile;

//     if (Object.keys(update).length === 0) {
//       return send(res, 400, false, "No parent info fields provided");
//     }

//     const filter = applyScope({ _id: id }, counsellorScope(req));
//     const lead   = await Inquiry.findOneAndUpdate(filter, { $set: update }, { new: true });
//     if (!lead) return send(res, 404, false, "Lead not found");

//     appendTimeline(id, "info_updated", "Parent information updated", update, req.user);
//     return send(res, 200, true, "Parent information updated", lead);
//   } catch (error) {
//     console.error("updateParentInfo error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ───────────────────────────────────────────────────────────────────────────────
// // ── CONVERSION WORKFLOW ─────────────────────────────────────────────────────────
// // ───────────────────────────────────────────────────────────────────────────────
// const requestConversion = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const { note = "", finalFee = null } = req.body;

//     const filter = applyScope({ _id: id }, counsellorScope(req));
//     const lead   = await Inquiry.findOne(filter);
//     if (!lead) return send(res, 404, false, "Lead not found");

//     if (lead.leadStatus === "converted") {
//       return send(res, 400, false, "This lead has already been converted", {
//         studentId: lead.convertedStudentId,
//       });
//     }

//     if (lead.conversionRequest?.status === "pending") {
//       return send(res, 400, false, "A conversion request is already pending for this lead");
//     }

//     // ── Admin / Super Admin: convert immediately ────────────────────────────
//     if (isApprover(req.user.role)) {
//       await Inquiry.findByIdAndUpdate(id, {
//         "conversionRequest.status":      "pending",
//         "conversionRequest.requestedBy": req.user.id,
//         "conversionRequest.requestedAt": new Date(),
//         "conversionRequest.requestNote": note,
//         "conversionRequest.finalFee":    finalFee,
//       });

//       const freshLead = await Inquiry.findById(id);
//       const result = await performConversion(freshLead, req.user);

//       return send(res, 201, true, "Lead converted to student successfully", result);
//     }

//     // ── Counsellor: create a pending request, do NOT convert ────────────────
//     const updated = await Inquiry.findByIdAndUpdate(
//       id,
//       {
//         "conversionRequest.status":          "pending",
//         "conversionRequest.requestedBy":     req.user.id,
//         "conversionRequest.requestedAt":     new Date(),
//         "conversionRequest.requestNote":     note,
//         "conversionRequest.finalFee":        finalFee,
//         "conversionRequest.rejectionReason": "",
//       },
//       { new: true }
//     );

//     appendTimeline(
//       id, "conversion_requested",
//       `${req.user.fullName || "Counsellor"} requested conversion to student${finalFee ? ` — final fee: ₹${finalFee}` : ""}`,
//       { note, finalFee },
//       req.user
//     );

//     const admins = await User.find({ role: { $in: ["admin", "super_admin"] }, isActive: true }).select("_id");
//     notifyMany(
//       admins.map((a) => a._id),
//       {
//         type:              "conversion_requested",
//         title:             "New conversion request",
//         body:              `${updated.fullName} (${updated.course}) — requested by ${req.user.fullName || "a counsellor"}.`,
//         link:              `/admin/leads/${updated._id}`,
//         relatedResource:   "Inquiry",
//         relatedResourceId: updated._id,
//       }
//     );

//     return send(res, 201, true, "Conversion request submitted — awaiting admin approval", updated);
//   } catch (error) {
//     console.error("requestConversion error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // PATCH /api/leads/:id/conversion-request/approve  — admin / super_admin only
// const approveConversionRequest = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const lead = await Inquiry.findById(id);
//     if (!lead) return send(res, 404, false, "Lead not found");

//     if (lead.leadStatus === "converted") {
//       return send(res, 400, false, "This lead has already been converted");
//     }
//     if (lead.conversionRequest?.status !== "pending") {
//       return send(res, 400, false, "There is no pending conversion request for this lead");
//     }

//     const result = await performConversion(lead, req.user);

//     if (lead.conversionRequest?.requestedBy) {
//       notify({
//         userId:            lead.conversionRequest.requestedBy,
//         type:              "conversion_approved",
//         title:             "Conversion request approved",
//         body:              `${lead.fullName} has been converted to a student.`,
//         link:              `/counsellor/leads/${lead._id}`,
//         relatedResource:   "Inquiry",
//         relatedResourceId: lead._id,
//       });
//     }

//     return send(res, 200, true, "Conversion request approved — student created", result);
//   } catch (error) {
//     console.error("approveConversionRequest error:", error);
//     if (error.code === 11000) return send(res, 409, false, "Email already registered");
//     return send(res, 500, false, "Server error");
//   }
// };

// // PATCH /api/leads/:id/conversion-request/reject  — admin / super_admin only
// const rejectConversionRequest = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const { rejectionReason = "" } = req.body;
//     if (!rejectionReason.trim()) {
//       return send(res, 400, false, "rejectionReason is required");
//     }

//     const lead = await Inquiry.findById(id);
//     if (!lead) return send(res, 404, false, "Lead not found");

//     if (lead.conversionRequest?.status !== "pending") {
//       return send(res, 400, false, "There is no pending conversion request for this lead");
//     }

//     const updated = await Inquiry.findByIdAndUpdate(
//       id,
//       {
//         "conversionRequest.status":          "rejected",
//         "conversionRequest.rejectedBy":      req.user.id,
//         "conversionRequest.rejectedAt":      new Date(),
//         "conversionRequest.rejectionReason": rejectionReason,
//       },
//       { new: true }
//     );

//     appendTimeline(
//       id, "conversion_rejected",
//       `Conversion request rejected — ${rejectionReason}`,
//       { rejectionReason },
//       req.user
//     );

//     if (lead.conversionRequest?.requestedBy) {
//       notify({
//         userId:            lead.conversionRequest.requestedBy,
//         type:              "conversion_rejected",
//         title:             "Conversion request rejected",
//         body:              `${lead.fullName}'s conversion was rejected: ${rejectionReason}`,
//         link:              `/counsellor/leads/${lead._id}`,
//         relatedResource:   "Inquiry",
//         relatedResourceId: lead._id,
//       });
//     }

//     return send(res, 200, true, "Conversion request rejected", updated);
//   } catch (error) {
//     console.error("rejectConversionRequest error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // GET /api/leads/conversion-requests/pending — admin / super_admin only
// const getPendingConversionRequests = async (req, res) => {
//   try {
//    const leads = await Inquiry.find({ "conversionRequest.status": "pending" })
//   .populate("conversionRequest.requestedBy", "fullName email role")
//   .populate("assignedToId", "fullName email")
//   .populate("course", "title slug category")
//   .sort({ "conversionRequest.requestedAt": -1 });
//     return send(res, 200, true, "Pending conversion requests fetched", leads, {
//       count: leads.length,
//     });
//   } catch (error) {
//     console.error("getPendingConversionRequests error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // Backward-compat alias: old frontend code may still call /convert directly.
// const convertToStudent = requestConversion;

// // ── POST /api/leads/:id/lost ───────────────────────────────────────────────────
// const markLeadLost = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const { lostReason = "", competitor = "", remarks = "" } = req.body;

//     const filter   = applyScope({ _id: id }, counsellorScope(req));
//     const existing = await Inquiry.findOne(filter);
//     if (!existing) return send(res, 404, false, "Lead not found");

//     const prevStatus = existing.leadStatus;

//     const lead = await Inquiry.findOneAndUpdate(
//       filter,
//       {
//         leadStatus:  "lost",
//         lostReason,
//         competitor,
//         lostAt:      new Date(),
//         lostBy:      req.user.id,
//         remarks:     remarks || existing.remarks,
//       },
//       { new: true }
//     );

//     logStatusChange(id, prevStatus, "lost", req.user, lostReason);
//     appendTimeline(
//       id, "lost",
//       `Lead marked as lost${lostReason ? ` — ${lostReason}` : ""}${competitor ? ` (went with: ${competitor})` : ""}`,
//       { lostReason, competitor, remarks },
//       req.user
//     );

//     return send(res, 200, true, "Lead marked as lost", lead);
//   } catch (error) {
//     console.error("markLeadLost error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── GET /api/leads/duplicates/check ───────────────────────────────────────────
// const checkDuplicates = async (req, res) => {
//   try {
//     const { mobile, email } = req.query;

//     if (!mobile && !email) {
//       return send(res, 400, false, "Provide at least one of: mobile, email");
//     }

//     const conditions = [];
//     if (mobile) conditions.push({ mobileNumber: mobile.trim() });
//     if (email)  conditions.push({ email: email.trim().toLowerCase() });

//     const duplicates = await Inquiry.find({ $or: conditions })
//       .select("fullName mobileNumber email course leadStatus createdAt assignedTo assignedToId")
//       .populate("assignedToId", "fullName")
//       .sort({ createdAt: -1 })
//       .limit(10);

//     return send(res, 200, true, "Duplicate check complete", duplicates, {
//       hasDuplicates: duplicates.length > 0,
//       count: duplicates.length,
//     });
//   } catch (error) {
//     console.error("checkDuplicates error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── POST /api/leads/merge ──────────────────────────────────────────────────────
// const mergeLeads = async (req, res) => {
//   try {
//     const { sourceId, targetId, reason = "" } = req.body;

//     if (!isValidId(sourceId) || !isValidId(targetId)) {
//       return send(res, 400, false, "Invalid sourceId or targetId");
//     }
//     if (sourceId === targetId) {
//       return send(res, 400, false, "sourceId and targetId must be different");
//     }

//     const [source, target] = await Promise.all([
//       Inquiry.findById(sourceId),
//       Inquiry.findById(targetId),
//     ]);
//     if (!source) return send(res, 404, false, "Source lead not found");
//     if (!target) return send(res, 404, false, "Target lead not found");

//     await LeadFollowUp.updateMany({ leadId: sourceId }, { leadId: targetId });

//     if (source.documents?.length) {
//       const existingUrls = new Set(target.documents.map((d) => d.url));
//       const newDocs = source.documents.filter((d) => !existingUrls.has(d.url));
//       if (newDocs.length) {
//         await Inquiry.findByIdAndUpdate(targetId, { $push: { documents: { $each: newDocs } } });
//       }
//     }

//     if (source.feeHistory?.length) {
//       await Inquiry.findByIdAndUpdate(targetId, { $push: { feeHistory: { $each: source.feeHistory } } });
//     }

//     await Inquiry.findByIdAndUpdate(sourceId, {
//       leadStatus: "lost",
//       lostReason: `Merged into lead ${targetId}. ${reason}`.trim(),
//       lostAt:     new Date(),
//       lostBy:     req.user.id,
//     });

//     appendTimeline(
//       targetId, "info_updated",
//       `Merged with duplicate lead (${source.fullName} / ${source.mobileNumber})`,
//       { mergedFromId: sourceId, reason },
//       req.user
//     );

//     appendTimeline(
//       sourceId, "lost",
//       `Lead merged into ${targetId} and closed`,
//       { mergedIntoId: targetId, reason },
//       req.user
//     );

//     const merged = await Inquiry.findById(targetId);
//     return send(res, 200, true, "Leads merged successfully", merged);
//   } catch (error) {
//     console.error("mergeLeads error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── GET /api/leads/:id/timeline ────────────────────────────────────────────────
// const getLeadTimeline = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     if (req.user.role === "counsellor") {
//       const lead = await Inquiry.findOne(applyScope({ _id: id }, counsellorScope(req))).select("_id");
//       if (!lead) return send(res, 404, false, "Lead not found");
//     }

//     const [timeline, followUps] = await Promise.all([
//       LeadTimeline.find({ leadId: id }).sort({ createdAt: -1 }).limit(100),
//       LeadFollowUp.find({ leadId: id }).sort({ createdAt: -1 }),
//     ]);

//     return send(res, 200, true, "Timeline fetched", { timeline, followUps });
//   } catch (error) {
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── GET /api/leads/:id/fee-history ─────────────────────────────────────────────
// const getFeeHistory = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const filter = applyScope({ _id: id }, counsellorScope(req));
//     const lead = await Inquiry.findOne(filter)
//       .select("feeHistory fees")
//       .populate("feeHistory.changedBy", "fullName email role");

//     if (!lead) return send(res, 404, false, "Lead not found");

//     const sorted = [...lead.feeHistory].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
//     return send(res, 200, true, "Fee history fetched", sorted, { currentFees: lead.fees });
//   } catch (error) {
//     console.error("getFeeHistory error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── GET /api/leads/:id/status-history ─────────────────────────────────────────
// const getStatusHistory = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const history = await LeadStatusHistory.find({ leadId: id }).sort({ createdAt: -1 });
//     return send(res, 200, true, "Status history fetched", history);
//   } catch (error) {
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── GET /api/leads/:id/assign-history ─────────────────────────────────────────
// const getAssignmentHistory = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const history = await LeadAssignmentHistory.find({ leadId: id }).sort({ createdAt: -1 });
//     return send(res, 200, true, "Assignment history fetched", history);
//   } catch (error) {
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── GET /api/leads/analytics/counsellor ───────────────────────────────────────
// // NEW: includes `byHealth` — counts per leadHealth bucket, independent of
// // leadStatus workflow stats which remain unchanged.
// const getCounsellorAnalytics = async (req, res) => {
//   try {
//     const isCounsellorRole = req.user.role === "counsellor";

//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

//     const scopeFilter = isCounsellorRole ? counsellorScope(req) : {};

//     const [
//       totalLeads, myLeads, converted, lost,
//       followUpDueToday, overdueFollowUps,
//       demosToday, contacted, pendingConversions,
//       healthCounts,
//     ] = await Promise.all([
//       Inquiry.countDocuments({ ...scopeFilter }),
//       isCounsellorRole ? Inquiry.countDocuments(scopeFilter) : null,
//       Inquiry.countDocuments({ ...scopeFilter, leadStatus: "converted" }),
//       Inquiry.countDocuments({ ...scopeFilter, leadStatus: "lost" }),
//       Inquiry.countDocuments({
//         ...scopeFilter,
//         nextFollowUpDate: { $gte: today, $lt: tomorrow },
//         leadStatus: { $nin: ["converted", "lost"] },
//       }),
//       Inquiry.countDocuments({
//         ...scopeFilter,
//         nextFollowUpDate: { $lt: today },
//         leadStatus: { $nin: ["converted", "lost"] },
//       }),
//       Inquiry.countDocuments({
//         ...scopeFilter,
//         demoScheduledAt: { $gte: today, $lt: tomorrow },
//       }),
//       Inquiry.countDocuments({ ...scopeFilter, leadStatus: "contacted" }),
//       Inquiry.countDocuments({ ...scopeFilter, "conversionRequest.status": "pending" }),
//       Inquiry.aggregate([
//         { $match: scopeFilter },
//         { $group: { _id: "$leadHealth", count: { $sum: 1 } } },
//       ]),
//     ]);

//     const total          = totalLeads;
//     const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

//     const byHealth = LEAD_HEALTH_OPTIONS.reduce((acc, h) => {
//       acc[h] = healthCounts.find((c) => c._id === h)?.count || 0;
//       return acc;
//     }, {});

//     if (!isCounsellorRole) {
//       const counsellorStats = await Inquiry.aggregate([
//         { $match: { assignedToId: { $ne: null } } },
//         {
//           $group: {
//             _id:        "$assignedToId",
//             total:      { $sum: 1 },
//             converted:  { $sum: { $cond: [{ $eq: ["$leadStatus", "converted"] }, 1, 0] } },
//             lost:       { $sum: { $cond: [{ $eq: ["$leadStatus", "lost"] }, 1, 0] } },
//             followUpDue: {
//               $sum: {
//                 $cond: [
//                   { $and: [
//                     { $gte: ["$nextFollowUpDate", today] },
//                     { $lt:  ["$nextFollowUpDate", tomorrow] },
//                   ]},
//                   1, 0,
//                 ],
//               },
//             },
//           },
//         },
//         {
//           $lookup: {
//             from:         "users",
//             localField:   "_id",
//             foreignField: "_id",
//             as:           "counsellor",
//           },
//         },
//         { $unwind: { path: "$counsellor", preserveNullAndEmpty: true } },
//         {
//           $project: {
//             counsellorId:   "$_id",
//             name:           "$counsellor.fullName",
//             email:          "$counsellor.email",
//             total:          1,
//             converted:      1,
//             lost:           1,
//             followUpDue:    1,
//             conversionRate: {
//               $cond: [
//                 { $gt: ["$total", 0] },
//                 { $multiply: [{ $divide: ["$converted", "$total"] }, 100] },
//                 0,
//               ],
//             },
//           },
//         },
//         { $sort: { converted: -1 } },
//       ]);

//       return send(res, 200, true, "Analytics fetched", {
//         overview: {
//           total, converted, lost, conversionRate,
//           followUpDueToday, overdueFollowUps, demosToday, contacted, pendingConversions,
//         },
//         byCounsellor: counsellorStats,
//         byHealth,
//       });
//     }

//     return send(res, 200, true, "Your analytics", {
//       myLeads:         myLeads ?? total,
//       converted,
//       lost,
//       conversionRate,
//       followUpDueToday,
//       overdueFollowUps,
//       demosToday,
//       contacted,
//       pendingConversions,
//       byHealth,
//     });
//   } catch (error) {
//     console.error("getCounsellorAnalytics error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ─── Other existing handlers (unchanged) ────────────────────────────────────────

// // updateLeadInfo also accepts a standalone `leadHealth` change (e.g. from a
// // quick-set dropdown in the UI that isn't part of the full edit form).
// const updateLeadInfo = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { fees, parentInfo, branch, demoCompleted, leadHealth } = req.body;

//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const update = {};
//     if (fees !== undefined) {
//       if (fees.min !== undefined) update["fees.min"] = fees.min;
//       if (fees.max !== undefined) update["fees.max"] = fees.max;
//       if (fees.negotiatedAmount !== undefined) update["fees.negotiatedAmount"] = fees.negotiatedAmount;
//       if (fees.originalFee !== undefined) update["fees.originalFee"] = fees.originalFee;
//     }
//     if (parentInfo !== undefined) {
//       if (parentInfo.name     !== undefined) update["parentInfo.name"]     = parentInfo.name;
//       if (parentInfo.relation !== undefined) update["parentInfo.relation"] = parentInfo.relation;
//       if (parentInfo.fatherName     !== undefined) update["parentInfo.fatherName"]     = parentInfo.fatherName;
//       if (parentInfo.motherName     !== undefined) update["parentInfo.motherName"]     = parentInfo.motherName;
//       if (parentInfo.guardianName   !== undefined) update["parentInfo.guardianName"]   = parentInfo.guardianName;
//       if (parentInfo.guardianMobile !== undefined) update["parentInfo.guardianMobile"] = parentInfo.guardianMobile;
//     }
//     if (branch          !== undefined) update.branch          = branch;
//     if (demoCompleted   !== undefined) {
//       update.demoCompleted   = demoCompleted;
//       update.demoCompletedAt = demoCompleted ? new Date() : null;
//     }
//     if (leadHealth !== undefined) {
//       if (!LEAD_HEALTH_OPTIONS.includes(leadHealth)) {
//         return send(res, 400, false, "Invalid leadHealth value");
//       }
//       update.leadHealth = leadHealth;
//     }

//     if (Object.keys(update).length === 0) {
//       return send(res, 400, false, "No valid fields provided");
//     }

//     const filter = applyScope({ _id: id }, counsellorScope(req));
//     const lead   = await Inquiry.findOneAndUpdate(filter, { $set: update }, { new: true });
//     if (!lead) return send(res, 404, false, "Lead not found");

//     appendTimeline(
//       id, "info_updated",
//       leadHealth !== undefined ? `Lead health changed to "${leadHealth}"` : "Lead info updated",
//       update,
//       req.user
//     );
//     return send(res, 200, true, "Lead info updated", lead);
//   } catch (error) {
//     console.error("updateLeadInfo error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// const updateObjections = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { objections } = req.body;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");
//     if (!Array.isArray(objections)) return send(res, 400, false, "objections must be an array");

//     const filter = applyScope({ _id: id }, counsellorScope(req));
//     const lead   = await Inquiry.findOneAndUpdate(filter, { objections }, { new: true });
//     if (!lead) return send(res, 404, false, "Lead not found");

//     appendTimeline(id, "objections_updated", `Objections updated (${objections.length} item(s))`, { objections }, req.user);
//     return send(res, 200, true, "Objections updated", lead);
//   } catch (error) {
//     return send(res, 500, false, "Server error");
//   }
// };

// const addDocument = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, url, type } = req.body;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");
//     if (!name || !url) return send(res, 400, false, "name and url are required");

//     const filter = applyScope({ _id: id }, counsellorScope(req));
//     const lead   = await Inquiry.findOneAndUpdate(
//       filter,
//       { $push: { documents: { name, url, type: type || null, uploadedAt: new Date() } } },
//       { new: true }
//     );
//     if (!lead) return send(res, 404, false, "Lead not found");

//     appendTimeline(id, "document_added", `Document added: ${name}`, { name, url, type }, req.user);
//     return send(res, 201, true, "Document added", lead);
//   } catch (error) {
//     return send(res, 500, false, "Server error");
//   }
// };

// const removeDocument = async (req, res) => {
//   try {
//     const { id, docId } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const filter = applyScope({ _id: id }, counsellorScope(req));
//     const lead   = await Inquiry.findOneAndUpdate(
//       filter,
//       { $pull: { documents: { _id: docId } } },
//       { new: true }
//     );
//     if (!lead) return send(res, 404, false, "Lead not found");

//     appendTimeline(id, "document_removed", `Document removed (ID: ${docId})`, { docId }, req.user);
//     return send(res, 200, true, "Document removed", lead);
//   } catch (error) {
//     return send(res, 500, false, "Server error");
//   }
// };

// // createFollowUp — nextFollowUpDate now carries full date+time precision
// // (frontend sends a datetime-local value). No backend change needed since
// // Date() already preserves time; comment added for clarity only.
// const createFollowUp = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { contactedBy, communicationType, note, nextFollowUpDate } = req.body;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const filter = applyScope({ _id: id }, counsellorScope(req));
//     const lead   = await Inquiry.findOne(filter);
//     if (!lead) return send(res, 404, false, "Lead not found");

//     const followUp = await LeadFollowUp.create({
//       leadId: id, contactedBy, communicationType, note,
//       nextFollowUpDate: nextFollowUpDate || null,
//     });

//     await Inquiry.findByIdAndUpdate(id, {
//       lastContactedAt:  new Date(),
//       nextFollowUpDate: nextFollowUpDate || lead.nextFollowUpDate,
//       leadStatus:       "follow-up",
//     });

//     appendTimeline(
//       id, "followup_added",
//       `Follow-up added via ${communicationType} by ${contactedBy}${
//         nextFollowUpDate ? ` — next: ${new Date(nextFollowUpDate).toLocaleString("en-IN")}` : ""
//       }`,
//       { followUpId: followUp._id, communicationType, nextFollowUpDate },
//       req.user
//     );

//     return send(res, 201, true, "Follow-up created", followUp);
//   } catch (error) {
//     console.error("createFollowUp error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// const getFollowUps = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (req.user.role === "counsellor") {
//       const lead = await Inquiry.findOne(applyScope({ _id: id }, counsellorScope(req))).select("_id");
//       if (!lead) return send(res, 404, false, "Lead not found");
//     }
//     const followUps = await LeadFollowUp.find({ leadId: id }).sort({ createdAt: -1 });
//     return send(res, 200, true, "Follow-ups fetched", followUps);
//   } catch (error) {
//     return send(res, 500, false, "Server error");
//   }
// };

// // const getLeadDashboard = async (req, res) => {
// //   try {
// //     const scope = counsellorScope(req);
// //     const [total, newLeads, contacted, followUpPending, converted, lost, pendingConversions, healthCounts] = await Promise.all([
// //       Inquiry.countDocuments({ ...scope }),
// //       Inquiry.countDocuments({ ...scope, leadStatus: "new" }),
// //       Inquiry.countDocuments({ ...scope, leadStatus: "contacted" }),
// //       Inquiry.countDocuments({ ...scope, leadStatus: "follow-up" }),
// //       Inquiry.countDocuments({ ...scope, leadStatus: "converted" }),
// //       Inquiry.countDocuments({ ...scope, leadStatus: "lost" }),
// //       Inquiry.countDocuments({ ...scope, "conversionRequest.status": "pending" }),
// //       Inquiry.aggregate([
// //         { $match: scope },
// //         { $group: { _id: "$leadHealth", count: { $sum: 1 } } },
// //       ]),
// //     ]);
// //     const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

// //     const byHealth = LEAD_HEALTH_OPTIONS.reduce((acc, h) => {
// //       acc[h] = healthCounts.find((c) => c._id === h)?.count || 0;
// //       return acc;
// //     }, {});

// //     return send(res, 200, true, "Dashboard fetched", {
// //       totalLeads: total, newLeads, contactedLeads: contacted,
// //       followUpsPending: followUpPending, convertedLeads: converted,
// //       lostLeads: lost, conversionRate, pendingConversions,
// //       byHealth,
// //     });
// //   } catch (error) {
// //     return send(res, 500, false, "Server error");
// //   }
// // };


// const getLeadDashboard = async (req, res) => {
//   try {
//     const { search = "", status = "", course = "", leadHealth = "" } = req.query;

//     // Base filter excludes status so each status bucket can still be computed;
//     // Total additionally applies status when the caller explicitly filtered by it.
//     const baseFilter = applyScope(
//       buildLeadFilterQuery({ search, course, leadHealth }),
//       counsellorScope(req)
//     );
//     // const totalFilter = status ? { ...baseFilter, leadStatus: status } : baseFilter;

//         const totalFilter = status ? applyStatusFilter({ ...baseFilter }, status) : baseFilter;

//     const [total, newLeads, contacted, followUpPending, converted, lost, pendingConversions, healthCounts] = await Promise.all([
//       Inquiry.countDocuments(totalFilter),
//       Inquiry.countDocuments({ ...baseFilter, leadStatus: "new" }),
//       Inquiry.countDocuments({ ...baseFilter, leadStatus: "contacted" }),
//       Inquiry.countDocuments({ ...baseFilter, leadStatus: "follow-up" }),
//       Inquiry.countDocuments({ ...baseFilter, leadStatus: "converted" }),
//       Inquiry.countDocuments({ ...baseFilter, leadStatus: "lost" }),
//       Inquiry.countDocuments({ ...baseFilter, "conversionRequest.status": "pending" }),
//       Inquiry.aggregate([
//         { $match: baseFilter },
//         { $group: { _id: "$leadHealth", count: { $sum: 1 } } },
//       ]),
//     ]);
//     const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

//     const byHealth = LEAD_HEALTH_OPTIONS.reduce((acc, h) => {
//       acc[h] = healthCounts.find((c) => c._id === h)?.count || 0;
//       return acc;
//     }, {});

//     return send(res, 200, true, "Dashboard fetched", {
//       totalLeads: total, newLeads, contactedLeads: contacted,
//       followUpsPending: followUpPending, convertedLeads: converted,
//       lostLeads: lost, conversionRate, pendingConversions,
//       byHealth,
//     });
//   } catch (error) {
//     return send(res, 500, false, "Server error");
//   }
// };

// // const getAllFollowUps = async (req, res) => {
// //   try {
// //     const { filter = "all" } = req.query;
// //     const scope = counsellorScope(req);
// //     const today    = new Date(); today.setHours(0, 0, 0, 0);
// //     const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
// //     const weekEnd  = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
// //     let dateQuery = {};
// //     if (filter === "today")    dateQuery = { nextFollowUpDate: { $gte: today, $lt: tomorrow } };
// //     else if (filter === "tomorrow") dateQuery = { nextFollowUpDate: { $gte: tomorrow, $lt: new Date(tomorrow.getTime() + 86400000) } };
// //     else if (filter === "week")    dateQuery = { nextFollowUpDate: { $gte: today, $lt: weekEnd } };
// //     else if (filter === "overdue") dateQuery = { nextFollowUpDate: { $lt: today } };
// //     const leads = await Inquiry.find({
// //       ...scope, nextFollowUpDate: { $ne: null }, ...dateQuery,
// //     }).sort({ nextFollowUpDate: 1 });
// //     return send(res, 200, true, "Follow-ups fetched", leads);
// //   } catch (error) {
// //     return send(res, 500, false, "Server error");
// //   }
// // };

// // updateLeadDetails — NOW accepts leadHealth alongside the standard editable
// // fields. leadHealth is validated against LEAD_HEALTH_OPTIONS and is fully
// // independent of leadStatus (the workflow field) — updating one never
// // touches the other.
// // const updateLeadDetails = async (req, res) => {
// //   try {
// //     const { id } = req.params;
// //     // if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

// //     if (course !== undefined) {
// //   if (!isValidId(course)) return send(res, 400, false, "Invalid course selected");
// //   const courseExists = await Course.findById(course).select("_id");
// //   if (!courseExists) return send(res, 400, false, "Selected course does not exist");
// //   update.course = course;
// // }

// //     const { fullName, mobileNumber, email, course, source, remarks, leadHealth } = req.body;
// //     const update = {};
// //     if (fullName     !== undefined) update.fullName     = fullName.trim();
// //     if (mobileNumber !== undefined) update.mobileNumber = mobileNumber.trim();
// //     if (email         !== undefined) update.email        = email ? email.toLowerCase().trim() : "";
// //     if (course        !== undefined) update.course       = course;
// //     if (source        !== undefined) update.source       = source;
// //     if (remarks        !== undefined) update.remarks      = remarks;
// //     if (leadHealth     !== undefined) {
// //       if (!LEAD_HEALTH_OPTIONS.includes(leadHealth)) {
// //         return send(res, 400, false, "Invalid leadHealth value");
// //       }
// //       update.leadHealth = leadHealth;
// //     }

// //     if (Object.keys(update).length === 0) {
// //       return send(res, 400, false, "No valid fields provided");
// //     }

// //     const filter = applyScope({ _id: id }, counsellorScope(req));

// //     const lead = await Inquiry.findOneAndUpdate(filter, { $set: update }, { new: true });
// //     if (!lead) return send(res, 404, false, "Lead not found");

// //     appendTimeline(
// //       id, "info_updated",
// //       leadHealth !== undefined ? `Lead details edited (health → "${leadHealth}")` : "Lead details edited",
// //       update,
// //       req.user
// //     );
// //     return send(res, 200, true, "Lead details updated", lead);
// //   } catch (error) {
// //     console.error("updateLeadDetails error:", error);
// //     if (error.code === 11000) return send(res, 409, false, "Duplicate lead detected");
// //     return send(res, 500, false, "Server error");
// //   }
// // };
// const getAllFollowUps = async (req, res) => {
//   try {
//     const { filter = "all" } = req.query;
//     const scope = counsellorScope(req);
//     const today    = new Date(); today.setHours(0, 0, 0, 0);
//     const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
//     const weekEnd  = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
//     let dateQuery = {};
//     if (filter === "today")    dateQuery = { nextFollowUpDate: { $gte: today, $lt: tomorrow } };
//     else if (filter === "tomorrow") dateQuery = { nextFollowUpDate: { $gte: tomorrow, $lt: new Date(tomorrow.getTime() + 86400000) } };
//     else if (filter === "week")    dateQuery = { nextFollowUpDate: { $gte: today, $lt: weekEnd } };
//     else if (filter === "overdue") dateQuery = { nextFollowUpDate: { $lt: today } };

//     const leads = await Inquiry.find({
//       ...scope,
//       nextFollowUpDate: { $ne: null },
//       leadStatus: { $nin: ["converted", "lost"] }, // NEW — consistent with dashboard widget
//       ...dateQuery,
//     }).sort({ nextFollowUpDate: 1 });

//     return send(res, 200, true, "Follow-ups fetched", leads);
//   } catch (error) {
//     console.error("getAllFollowUps error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// const updateLeadDetails = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const { fullName, mobileNumber, email, course, source, remarks, leadHealth } = req.body;
//     const update = {};

//     if (fullName     !== undefined) update.fullName     = fullName.trim();
//     if (mobileNumber !== undefined) update.mobileNumber = mobileNumber.trim();
//     if (email        !== undefined) update.email        = email ? email.toLowerCase().trim() : "";

//     if (course !== undefined) {
//       if (!isValidId(course)) return send(res, 400, false, "Invalid course selected");
//       const courseExists = await Course.findById(course).select("_id");
//       if (!courseExists) return send(res, 400, false, "Selected course does not exist");
//       update.course = course;
//     }

//     if (source   !== undefined) update.source  = source;
//     if (remarks  !== undefined) update.remarks = remarks;
//     if (leadHealth !== undefined) {
//       if (!LEAD_HEALTH_OPTIONS.includes(leadHealth)) {
//         return send(res, 400, false, "Invalid leadHealth value");
//       }
//       update.leadHealth = leadHealth;
//     }

//     if (Object.keys(update).length === 0) {
//       return send(res, 400, false, "No valid fields provided");
//     }

//     const filter = applyScope({ _id: id }, counsellorScope(req));
//     const lead = await Inquiry.findOneAndUpdate(filter, { $set: update }, { new: true });
//     if (!lead) return send(res, 404, false, "Lead not found");

//     appendTimeline(
//       id, "info_updated",
//       leadHealth !== undefined ? `Lead details edited (health → "${leadHealth}")` : "Lead details edited",
//       update,
//       req.user
//     );
//     return send(res, 200, true, "Lead details updated", lead);
//   } catch (error) {
//     console.error("updateLeadDetails error:", error);
//     if (error.code === 11000) return send(res, 409, false, "Duplicate lead detected");
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── DELETE /api/leads/:id — admin / super_admin only ───────────────────────────
// const deleteLead = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const lead = await Inquiry.findByIdAndDelete(id);
//     if (!lead) return send(res, 404, false, "Lead not found");

//     appendTimeline(id, "info_updated", `Lead deleted by ${req.user.fullName || "admin"}`, {}, req.user);
//     return send(res, 200, true, "Lead deleted");
//   } catch (error) {
//     console.error("deleteLead error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };


// // ── PATCH /api/leads/:id/assign-fee-collection ────────────────────────────────
// // Admin / Super Admin only. Independent from the lead counsellor (assignedToId).
// const assignFeeCollectionCounsellor = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { feeCollectionCounsellorId, reason = "" } = req.body;

//     if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     const lead = await Inquiry.findById(id);
//     if (!lead) return send(res, 404, false, "Lead not found");

//     let counsellor = null;
//     if (feeCollectionCounsellorId) {
//       if (!isValidId(feeCollectionCounsellorId)) {
//         return send(res, 400, false, "Invalid counsellor ID");
//       }
//       counsellor = await User.findById(feeCollectionCounsellorId).select("fullName email role isActive");
//       if (!counsellor) return send(res, 404, false, "Counsellor not found");
//     }

//     const update = {
//       feeCollectionCounsellor:   counsellor?.fullName || null,
//       feeCollectionCounsellorId: counsellor?._id || null,
//     };

//     const updated = await Inquiry.findByIdAndUpdate(id, update, { new: true });

//     appendTimeline(
//       id, "info_updated",
//       counsellor
//         ? `Fee collection counsellor assigned: ${counsellor.fullName}${reason ? ` — ${reason}` : ""}`
//         : "Fee collection counsellor unassigned",
//       { ...update, reason },
//       req.user
//     );

//     // If this lead already has a linked student, propagate immediately —
//     // don't wait for a re-conversion that will never happen.
//     if (updated.convertedStudentId) {
//       await User.findByIdAndUpdate(updated.convertedStudentId, {
//         feeCollectionCounsellor: counsellor?._id || null,
//       });
//     }

//     if (counsellor?._id) {
//       notify({
//         userId:            counsellor._id,
//         type:              "lead_assigned",
//         title:             "Fee collection assigned to you",
//         body:              `${updated.fullName} (${updated.course}) has been assigned to you for fee collection follow-ups.`,
//         link:              updated.convertedStudentId
//           ? `/counsellor/fee-collection/${updated.convertedStudentId}`
//           : `/admin/leads/${updated._id}`,
//         relatedResource:   "Inquiry",
//         relatedResourceId: updated._id,
//       });
//     }

//     return send(res, 200, true, "Fee collection counsellor updated", updated);
//   } catch (error) {
//     console.error("assignFeeCollectionCounsellor error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };


// // ── POST /api/leads/bulk-delete — admin / super_admin only ────────────────────
// const bulkDeleteLeads = async (req, res) => {
//   try {
//     const { ids } = req.body;
//     if (!Array.isArray(ids) || ids.length === 0) {
//       return send(res, 400, false, "Provide an array of lead IDs to delete");
//     }

//     const validIds = ids.filter((id) => isValidId(id));
//     if (validIds.length === 0) {
//       return send(res, 400, false, "No valid lead IDs provided");
//     }

//     const result = await Inquiry.deleteMany({ _id: { $in: validIds } });

//     validIds.forEach((id) => {
//       appendTimeline(
//         id, "info_updated",
//         `Lead deleted by ${req.user.fullName || "admin"} (bulk delete)`,
//         {}, req.user
//       );
//     });

//     return send(res, 200, true, `${result.deletedCount} lead(s) deleted`, {
//       deletedCount: result.deletedCount,
//     });
//   } catch (error) {
//     console.error("bulkDeleteLeads error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── PATCH /api/leads/bulk-assign — admin / super_admin only ───────────────────
// // body: { ids: string[], assignedToId: string | null }
// const bulkAssignLeads = async (req, res) => {
//   try {
//     const { ids, assignedToId } = req.body;

//     if (!Array.isArray(ids) || ids.length === 0) {
//       return send(res, 400, false, "Provide an array of lead IDs to assign");
//     }

//     const validIds = ids.filter((id) => isValidId(id));
//     if (validIds.length === 0) {
//       return send(res, 400, false, "No valid lead IDs provided");
//     }

//     let counsellor = null;
//     if (assignedToId) {
//       if (!isValidId(assignedToId)) return send(res, 400, false, "Invalid counsellor ID");
//       counsellor = await User.findById(assignedToId).select("fullName email role isActive");
//       if (!counsellor) return send(res, 404, false, "Counsellor not found");
//     }

//     // Fetch current assignment so we can log a proper before/after history entry per lead
//     const leads = await Inquiry.find({ _id: { $in: validIds } }).select("_id assignedToId fullName course");

//     const update = {
//       assignedTo: counsellor?.fullName || null,
//       assignedToId: counsellor?._id || null,
//     };

//     await Inquiry.updateMany({ _id: { $in: validIds } }, update);

//     // Resolve previous-counsellor names in one batch to avoid N queries
//     const prevIds = [...new Set(leads.filter((l) => l.assignedToId).map((l) => String(l.assignedToId)))];
//     const prevUsers = prevIds.length
//       ? await User.find({ _id: { $in: prevIds } }).select("fullName")
//       : [];
//     const prevMap = new Map(prevUsers.map((u) => [String(u._id), u.fullName]));

//     leads.forEach((lead) => {
//       const prevName = lead.assignedToId ? prevMap.get(String(lead.assignedToId)) : null;
//       logAssignment(
//         lead._id,
//         lead.assignedToId ? { id: lead.assignedToId, name: prevName || "Unknown" } : null,
//         counsellor ? { id: counsellor._id, name: counsellor.fullName } : null,
//         req.user,
//         "Bulk assignment"
//       );
//     });

//     if (counsellor?._id) {
//       notify({
//         userId: counsellor._id,
//         type: "lead_assigned",
//         title: "Multiple leads assigned to you",
//         body: `${validIds.length} lead(s) have been assigned to you.`,
//         link: `/counsellor/leads`,
//         relatedResource: "Inquiry",
//         relatedResourceId: null,
//       });
//     }

//     return send(res, 200, true, `${validIds.length} lead(s) assigned successfully`, {
//       updatedCount: validIds.length,
//     });
//   } catch (error) {
//     console.error("bulkAssignLeads error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };


// // ── GET /api/leads/export ─────────────────────────────────────────────────────
// // Exports ALL leads matching the current filters.
// // No pagination is applied.
// const exportLeads = async (req, res) => {
//   try {
//     const {
//       search = "",
//       status = "",
//       course = "",
//       priority = "",
//       source = "",
//       assignedToId = "",
//       unassigned = "",
//       leadHealth = "",
//     } = req.query;

//     // Use the exact same filters as the normal leads listing
//     let query = buildLeadFilterQuery({
//       search,
//       status,
//       course,
//       leadHealth,
//     });

//     if (priority) query.priority = priority;
//     if (source) query.source = source;

//     if (assignedToId && isValidId(assignedToId)) {
//       query.assignedToId = assignedToId;
//     }

//     if (unassigned === "true") {
//       query.assignedToId = null;
//     }

//     // Keep counsellor visibility rules identical to GET /api/leads
//     query = applyScope(query, counsellorScope(req));

//     const leads = await Inquiry.find(query)
//       .sort({ priority: -1, createdAt: -1 })
//       .populate("assignedToId", "fullName email role")
//       .populate("createdBy", "fullName email role")
//       .populate("course", "title slug category")
//       .lean();

//     const escapeCsv = (value) => {
//       if (value === null || value === undefined) return "";

//       const stringValue = String(value)
//         .replace(/\r?\n|\r/g, " ")
//         .trim();

//       return `"${stringValue.replace(/"/g, '""')}"`;
//     };

//     const formatDate = (value) => {
//       if (!value) return "";
//       return new Date(value).toLocaleString("en-IN");
//     };

//     const rows = leads.map((lead) => ({
//       Name: lead.fullName || "",
//       Phone: lead.mobileNumber || "",
//       Email: lead.email || "",
//       Course: lead.course?.title || "",
//       Status: lead.leadStatus || "",
//       Health: lead.leadHealth || "",
//       Priority: lead.priority || "",
//       Source: lead.source || "",
//       "Assigned To": lead.assignedToId?.fullName || lead.assignedTo || "",
//       "Created By": lead.createdBy?.fullName || "",
//       "Next Follow Up": formatDate(lead.nextFollowUpDate),
//       "Created At": formatDate(lead.createdAt),
//       Remarks: lead.remarks || "",
//     }));

//     const headers = [
//       "Name",
//       "Phone",
//       "Email",
//       "Course",
//       "Status",
//       "Health",
//       "Priority",
//       "Source",
//       "Assigned To",
//       "Created By",
//       "Next Follow Up",
//       "Created At",
//       "Remarks",
//     ];

//     const csv = [
//       headers.map(escapeCsv).join(","),
//       ...rows.map((row) =>
//         headers.map((header) => escapeCsv(row[header])).join(",")
//       ),
//     ].join("\r\n");

//     // UTF-8 BOM makes Hindi/Unicode text open correctly in Excel
//     const csvWithBom = "\uFEFF" + csv;

//     res.setHeader("Content-Type", "text/csv; charset=utf-8");
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename="leads-${new Date()
//         .toISOString()
//         .slice(0, 10)}.csv"`
//     );

//     return res.status(200).send(csvWithBom);
//   } catch (error) {
//     console.error("exportLeads error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to export leads",
//     });
//   }
// };



// const getDashboardPendingFollowUps = async (req, res) => {
//   try {
//     const scope = counsellorScope(req);
//     const now = new Date();

//     const leads = await Inquiry.find({
//       ...scope,
//       nextFollowUpDate: { $ne: null },
//       leadStatus: { $nin: ["converted", "lost"] },
//     })
//       .select("fullName course nextFollowUpDate leadStatus assignedTo assignedToId")
//       .populate("course", "title slug category")
//       .lean();

//     const withFlag = leads.map((l) => ({
//       ...l,
//       isOverdue: new Date(l.nextFollowUpDate) < now,
//     }));

//     // Overdue items sorted nearest-to-now first (most urgent/relevant),
//     // then upcoming items sorted soonest-first. Overdue always leads
//     // since it's still pending and needs attention.
//     withFlag.sort((a, b) => {
//       if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
//       const aTime = new Date(a.nextFollowUpDate).getTime();
//       const bTime = new Date(b.nextFollowUpDate).getTime();
//       return a.isOverdue ? bTime - aTime : aTime - bTime;
//     });

//     return send(res, 200, true, "Pending follow-ups fetched", withFlag.slice(0, 5));
//   } catch (error) {
//     console.error("getDashboardPendingFollowUps error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };


// module.exports = {
//   createLead,              
//   getAllLeads,
//   getLeadById,
//   updateLeadStatus,
//   assignLead,
//   updateLeadInfo,
//   updateObjections,
//   addDocument,
//   removeDocument,
//   createFollowUp,
//   getFollowUps,
//   getLeadDashboard,
//   getAllFollowUps,
//   updateLeadPriority,
//   updateDemoInfo,
//   updatePaymentPlan,
//   updateParentInfo,
//   getFeeHistory,
//   convertToStudent,
//   requestConversion,
//   approveConversionRequest,
//   rejectConversionRequest,
//   getPendingConversionRequests,
//   markLeadLost,
//   checkDuplicates,
//   mergeLeads,
//   getLeadTimeline,
//   getStatusHistory,
//   getAssignmentHistory,
//   getCounsellorAnalytics,
//   updateLeadDetails,
//   deleteLead,
//   assignFeeCollectionCounsellor,
//    bulkDeleteLeads,
//   bulkAssignLeads,
//   exportLeads,
//   getDashboardPendingFollowUps,
// };









const mongoose   = require("mongoose");
const bcrypt     = require("bcryptjs");

const Inquiry               = require("../models/Inquiry");
const { LEAD_HEALTH_OPTIONS } = require("../models/Inquiry");
const LeadFollowUp          = require("../models/LeadFollowUp");
const LeadTimeline          = require("../models/LeadTimeline");
const LeadStatusHistory     = require("../models/LeadStatusHistory");
const LeadAssignmentHistory = require("../models/LeadAssignmentHistory");
const User                  = require("../models/User");
const Enrollment            = require("../models/Enrollment");
const Course                = require("../models/Course");

const { appendTimeline, logStatusChange, logAssignment }  = require("../utils/timeline");
const { notify, notifyMany }                              = require("../utils/notify");



// ── Helpers ────────────────────────────────────────────────────────────────────

// UPDATED: a counsellor can now see leads that are either assigned to them
// OR that they personally created (even if not yet assigned, or reassigned
// to someone else later — they keep visibility into leads they logged).
// Returns {} for non-counsellor roles (no restriction — admin/super_admin
// see everything, as before).
const counsellorScope = (req) => {
  if (req.user.role === "counsellor") {
    return {
      $or: [
        { assignedToId: req.user.id },
        { createdBy: req.user.id },
      ],
    };
  }
  return {};
};

// Merges a counsellor-scope $or clause into a query that may already have its
// own $or (e.g. from a search filter), without one clobbering the other.
const applyScope = (query, scope) => {
  if (!scope || Object.keys(scope).length === 0) return query;
  if (scope.$or) {
    if (query.$or) {
      // Combine both $or clauses via $and so search AND scope both apply
      query.$and = [...(query.$and || []), { $or: query.$or }, { $or: scope.$or }];
      delete query.$or;
    } else {
      query.$or = scope.$or;
    }
  } else {
    Object.assign(query, scope);
  }
  return query;
};

// Shared filter builder — used by both getAllLeads and getLeadDashboard so
// stats and the list always reflect the same active filters.
// const buildLeadFilterQuery = ({ search = "", status = "", course = "", leadHealth = "" } = {}) => {
//   const query = {};
//   if (search) {
//     query.$or = [
//       { fullName:     { $regex: search, $options: "i" } },
//       { email:        { $regex: search, $options: "i" } },
//       { mobileNumber: { $regex: search, $options: "i" } },
//     ];
//   }
//   if (status) query.leadStatus = status;
//   if (course) query.course = course;
//   if (leadHealth && LEAD_HEALTH_OPTIONS.includes(leadHealth)) query.leadHealth = leadHealth;
//   return query;
// };


// "today" is a dynamic date-based filter (createdAt within today's calendar
// day), never persisted as a leadStatus value — recomputed fresh on every
// request from the current server date.
const applyStatusFilter = (query, status) => {
  if (!status) return query;
  if (status === "today") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    query.createdAt = { $gte: startOfToday, $lt: startOfTomorrow };
  } else {
    query.leadStatus = status;
  }
  return query;
};

const buildLeadFilterQuery = ({ search = "", status = "", course = "", leadHealth = "" } = {}) => {
  const query = {};
  if (search) {
    query.$or = [
      { fullName:     { $regex: search, $options: "i" } },
      { email:        { $regex: search, $options: "i" } },
      { mobileNumber: { $regex: search, $options: "i" } },
    ];
  }
  applyStatusFilter(query, status);
  if (course) query.course = course;
  if (leadHealth && LEAD_HEALTH_OPTIONS.includes(leadHealth)) query.leadHealth = leadHealth;
  return query;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const send = (res, status, success, message, data = undefined, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const isApprover = (role) => role === "admin" || role === "super_admin";

const MOBILE_REGEX = /^[6-9]\d{9}$/;
// const VALID_COURSES = ["UiUX", "GraphicDesign", "MotionVFX", "3D", "Marketing", "Data"];

// Generate a unique 4-digit student ID (same logic as admin.controller)
const generateUniqueStudentId = async () => {
  let studentId, exists = true;
  while (exists) {
    studentId = String(Math.floor(1000 + Math.random() * 9000));
    exists = await User.findOne({ studentId });
  }
  return studentId;
};

// Resolves the course title string saved on a lead to a real Course document
// (used for the Enrollment record). Falls back to null if no match found —
// enrollment is still created with the studentId/lead linkage either way.
// const resolveCourseDoc = async (courseValue) => {
//   if (!courseValue) return null;
//   if (isValidId(courseValue)) {
//     const byId = await Course.findById(courseValue);
//     if (byId) return byId;
//   }
const resolveCourseDoc = async (courseValue) => {
  if (!courseValue) return null;
  if (isValidId(courseValue)) return Course.findById(courseValue);
  return null; // legacy string values already migrated by the migration script
};

// Actually performs the student creation + enrollment + lead-conversion.
// Shared by: (a) admin/super_admin instant conversion, (b) approving a
// counsellor's pending conversion request.
//
// ── UPDATED: Fee-collection counsellor now falls back to the lead's own
// counsellor (assignedToId) when no explicit fee-collection assignment
// exists. This means a counsellor who handles and converts their own lead
// automatically gets fee-collection access to that student — no manual
// admin assignment required. Manual admin assignment (feeCollectionCounsellorId)
// still takes priority whenever it has been explicitly set.
const performConversion = async (lead, actingUser) => {
  // ── Resolve fee collection counsellor with fallback ────────────────────────
  // Priority: explicitly assigned fee-collection counsellor (admin override)
  //         → falls back to the lead's own counsellor (self-handled leads)
  //         → null if lead was never assigned to anyone
  const resolvedFeeCollectionCounsellorId =
    lead.feeCollectionCounsellorId || lead.assignedToId || null;

  // Existing-account linkage (no new password / studentId needed)
  // if (lead.email) {
  //   const existingUser = await User.findOne({ email: lead.email });
  //   if (existingUser) {
  //     if (lead.assignedToId && !existingUser.assignedCounsellor) {
  //       existingUser.assignedCounsellor = lead.assignedToId;
  //     }
  //     // UPDATED — use resolved value (with fallback) instead of raw field
  //     if (resolvedFeeCollectionCounsellorId && !existingUser.feeCollectionCounsellor) {
  //       existingUser.feeCollectionCounsellor = resolvedFeeCollectionCounsellorId;
  //     }
  //     await existingUser.save();


   if (lead.email) {
    const existingUser = await User.findOne({ email: lead.email });
    if (existingUser) {
      if (lead.assignedToId && !existingUser.assignedCounsellor) {
        existingUser.assignedCounsellor = lead.assignedToId;
      }
      // UPDATED — use resolved value (with fallback) instead of raw field
      if (resolvedFeeCollectionCounsellorId && !existingUser.feeCollectionCounsellor) {
        existingUser.feeCollectionCounsellor = resolvedFeeCollectionCounsellorId;
      }

      // ── NEW: sync phone number from lead if missing on the student ──
      if (lead.mobileNumber && !existingUser.phone) {
        existingUser.phone = lead.mobileNumber;
      }

      await existingUser.save();

      await Inquiry.findByIdAndUpdate(lead._id, {
        leadStatus:          "converted",
        convertedStudentId:  existingUser._id,
        convertedAt:         new Date(),
        convertedBy:         actingUser.id,
        "conversionRequest.status":     "approved",
        "conversionRequest.approvedBy": actingUser.id,
        "conversionRequest.approvedAt": new Date(),
      });

      const courseDoc = await resolveCourseDoc(lead.course);
      const existingEnrollment = await Enrollment.findOne({
        student: existingUser._id,
        ...(courseDoc ? { course: courseDoc._id } : {}),
      });
      if (!existingEnrollment && courseDoc) {
        await Enrollment.create({ student: existingUser._id, course: courseDoc._id });
      }

      logStatusChange(lead._id, lead.leadStatus, "converted", actingUser, "Linked to existing account");
      appendTimeline(lead._id, "converted", `Linked to existing student account (${existingUser.email})`, {}, actingUser);

      return { studentUserId: existingUser._id, linkedExisting: true };
    }
  }

  // Brand new student account
  const tempPassword   = lead.mobileNumber || "deepScode@1234";
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  const studentId      = await generateUniqueStudentId();

  const student = await User.create({
    fullName:   lead.fullName,
    email:      lead.email || `${lead.mobileNumber}@deepScodenoemail.local`,
    password:   hashedPassword,
    role:       "student",
    status:     "approved",
    studentId,
    isActive:   true,
    approvedAt: new Date(),
    createdBy:  actingUser.id,
    // ── FIX: copy the lead's assigned counsellor onto the new student ──
     phone: lead.mobileNumber || undefined,
    assignedCounsellor: lead.assignedToId || null,
    // UPDATED — falls back to lead's own counsellor when no manual override exists
    feeCollectionCounsellor: resolvedFeeCollectionCounsellorId,
  });

  const courseDoc = await resolveCourseDoc(lead.course);
  let enrollment = null;
  if (courseDoc) {
    enrollment = await Enrollment.create({ student: student._id, course: courseDoc._id });
  }

  await Inquiry.findByIdAndUpdate(lead._id, {
    leadStatus:          "converted",
    convertedStudentId:  student._id,
    convertedAt:         new Date(),
    convertedBy:         actingUser.id,
    "conversionRequest.status":     "approved",
    "conversionRequest.approvedBy": actingUser.id,
    "conversionRequest.approvedAt": new Date(),
  });

  logStatusChange(lead._id, lead.leadStatus, "converted", actingUser, "Student account created");
  appendTimeline(
    lead._id, "converted",
    `Converted to student — ID: ${studentId}`,
    { studentUserId: student._id, studentId, enrollmentId: enrollment?._id || null },
    actingUser
  );

  const admins = await User.find({ role: { $in: ["admin", "super_admin"] }, isActive: true }).select("_id");
  notifyMany(
    admins.map((a) => a._id),
    {
      type:              "lead_converted",
      title:             `${lead.fullName} converted to student`,
      body:              `Student ID: ${studentId}. Course: ${lead.course}.`,
      link:              `/admin/students/${student._id}`,
      relatedResource:   "User",
      relatedResourceId: student._id,
    }
  );

  return {
    studentUserId: student._id,
    student: {
      _id:       student._id,
      fullName:  student.fullName,
      email:     student.email,
      studentId: student.studentId,
    },
    enrollmentId: enrollment?._id || null,
    tempPassword,
  };
};

// ── POST /api/leads ─────────────────────────────────────────────────────────────
// NEW: unified lead creation for admin/super_admin/counsellor (mirrors the
// public inquiry form flow but for staff manually logging leads).
//
// Counsellor:
//   - assignedToId / assignedTo are ALWAYS forced to the logged-in counsellor,
//     regardless of what (if anything) was sent in the body — a counsellor
//     cannot create a lead and assign it to someone else.
//   - createdBy / createdByRole are always set from req.user.
//
// Admin / Super Admin:
//   - May optionally provide assignedToId to hand the lead straight to a
//     counsellor; otherwise it's created unassigned (same as before).
//   - createdBy / createdByRole are still recorded for audit purposes, but
//     do NOT restrict their own visibility (admins see everything).
//
// leadHealth (NEW): optional at creation. Independent of leadStatus workflow.
// Defaults to "Untouched" if omitted or invalid.
const createLead = async (req, res) => {
  try {
    const {
      fullName, mobileNumber, email, course,
      source, remarks, assignedToId, priority, leadHealth,
    } = req.body;

    // ── Validation (mirrors inquiryValidator rules) ───────────────────────────
    if (!fullName || !fullName.trim()) {
      return send(res, 422, false, "Full name is required");
    }
    if (!mobileNumber || !MOBILE_REGEX.test(mobileNumber.trim())) {
      return send(res, 422, false, "Enter a valid 10-digit Indian mobile number");
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return send(res, 422, false, "Enter a valid email address");
    }
    // if (!course || !VALID_COURSES.includes(course)) {
    //   return send(res, 422, false, "Invalid course selected");
    // }
    if (!course || !isValidId(course)) {
  return send(res, 422, false, "Invalid course selected");
}
const courseDoc = await Course.findById(course).select("_id title");
if (!courseDoc) {
  return send(res, 422, false, "Selected course does not exist");
}
    if (leadHealth !== undefined && !LEAD_HEALTH_OPTIONS.includes(leadHealth)) {
      return send(res, 422, false, "Invalid leadHealth value");
    }

    const normalizedEmail = email ? email.toLowerCase().trim() : undefined;

    // ── Duplicate check (same as public flow, only when email present) ───────
    if (normalizedEmail) {
      const existing = await Inquiry.findOne({ email: normalizedEmail, course });
      if (existing) {
        return send(res, 409, false, "A lead with this email already applied for this course.");
      }
    }

    const payload = {
      fullName: fullName.trim(),
      mobileNumber: mobileNumber.trim(),
      email: normalizedEmail,
      course,
      source: source || "Manual",
      remarks: remarks || "",
      priority: priority || "medium",
      leadHealth: LEAD_HEALTH_OPTIONS.includes(leadHealth) ? leadHealth : "Untouched",
      createdBy: req.user.id,
      createdByRole: req.user.role,
    };

    if (req.user.role === "counsellor") {
      // Force self-assignment — a counsellor cannot assign a lead to someone else
      const counsellor = await User.findById(req.user.id).select("fullName");
      payload.assignedToId = req.user.id;
      payload.assignedTo   = counsellor?.fullName || req.user.fullName || null;
    } else if (assignedToId && isValidId(assignedToId)) {
      // Admin / super_admin may optionally assign at creation time
      const counsellor = await User.findById(assignedToId).select("fullName");
      if (counsellor) {
        payload.assignedToId = counsellor._id;
        payload.assignedTo   = counsellor.fullName;
      }
    }

    const lead = await Inquiry.create(payload);

    appendTimeline(
      lead._id, "info_updated",
      `Lead created by ${req.user.fullName || req.user.role}${payload.assignedToId ? ` and assigned to ${payload.assignedTo}` : ""}`,
      { createdByRole: req.user.role, leadHealth: payload.leadHealth },
      req.user
    );

    if (payload.assignedToId && req.user.role !== "counsellor") {
      // Admin manually assigned it to a counsellor at creation — notify them
      notify({
        userId:            payload.assignedToId,
        type:              "lead_assigned",
        title:             "New lead assigned to you",
        body:              `${lead.fullName} (${lead.course}) has been assigned to you.`,
        link:              `/counsellor/leads/${lead._id}`,
        relatedResource:   "Inquiry",
        relatedResourceId: lead._id,
      });
    }

    return send(res, 201, true, "Lead created successfully", lead);
  } catch (error) {
    console.error("createLead error:", error);
    if (error.code === 11000) return send(res, 409, false, "Duplicate lead detected");
    return send(res, 500, false, "Server error");
  }
};

// ── GET /api/leads ─────────────────────────────────────────────────────────────
// const getAllLeads = async (req, res) => {
//   try {
//     const {
//       page = 1, limit = 20, search = "",
//       status = "", course = "", priority = "",
//       source = "", assignedToId = "", unassigned = "",
//       leadHealth = "",
//     } = req.query;

//     let query = {};

//     if (search) {
//       query.$or = [
//         { fullName:     { $regex: search, $options: "i" } },
//         { email:        { $regex: search, $options: "i" } },
//         { mobileNumber: { $regex: search, $options: "i" } },
//       ];
//     }
//     if (status)      query.leadStatus  = status;
//     if (course)      query.course      = course;
//     if (priority)    query.priority    = priority;
//     if (source)      query.source      = source;
//     if (leadHealth && LEAD_HEALTH_OPTIONS.includes(leadHealth)) query.leadHealth = leadHealth;
//     if (assignedToId && isValidId(assignedToId)) query.assignedToId = assignedToId;
//     if (unassigned === "true") query.assignedToId = null;

//     // Counsellor scope: leads assigned to them OR created by them.
//     // Safely merged with the search $or above (if present) via $and.
//     query = applyScope(query, counsellorScope(req));

//     const pageNum  = Math.max(1, parseInt(page,  10) || 1);
//     const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
//     const skip     = (pageNum - 1) * limitNum;

//     const total = await Inquiry.countDocuments(query);
//     const leads = await Inquiry.find(query)
//       .sort({ priority: -1, createdAt: -1 })
//       .skip(skip)
//       .limit(limitNum)
//       .populate("assignedToId", "fullName email role")
//       .populate("createdBy", "fullName email role");

//     return send(res, 200, true, "Leads fetched", leads, {
//       pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
//     });
//   } catch (error) {
//     console.error("getAllLeads error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };


const getAllLeads = async (req, res) => {
  try {
    const {
      page = 1, limit = 50, search = "",
      status = "", course = "", priority = "",
      source = "", assignedToId = "", unassigned = "",
      leadHealth = "",
    } = req.query;

    let query = buildLeadFilterQuery({ search, status, course, leadHealth });
    if (priority)    query.priority    = priority;
    if (source)      query.source      = source;
    if (assignedToId && isValidId(assignedToId)) query.assignedToId = assignedToId;
    if (unassigned === "true") query.assignedToId = null;

    query = applyScope(query, counsellorScope(req));

    const pageNum  = Math.max(1, parseInt(page,  10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const total = await Inquiry.countDocuments(query);
    const leads = await Inquiry.find(query)
  .sort({ priority: -1, createdAt: -1 })
  .skip(skip)
  .limit(limitNum)
  .populate("assignedToId", "fullName email role")
  .populate("createdBy", "fullName email role")
  .populate("course", "title slug category");

    return send(res, 200, true, "Leads fetched", leads, {
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("getAllLeads error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── GET /api/leads/:id ─────────────────────────────────────────────────────────
const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const filter = applyScope({ _id: id }, counsellorScope(req));
    const lead = await Inquiry.findOne(filter)
  .populate("assignedToId", "fullName email role")
  .populate("createdBy", "fullName email role")
  .populate("branch", "name code")
  .populate("convertedStudentId", "fullName email studentId")
  .populate("conversionRequest.requestedBy", "fullName email role")
  .populate("conversionRequest.approvedBy", "fullName email role")
  .populate("conversionRequest.rejectedBy", "fullName email role")
  .populate("feeHistory.changedBy", "fullName email role")
  .populate("course", "title slug category");

    if (!lead) {
      return send(res, 404, false,
        req.user.role === "counsellor" ? "Lead not found or not assigned to you" : "Lead not found"
      );
    }

    const followUps = await LeadFollowUp.find({ leadId: id }).sort({ createdAt: -1 });
    return send(res, 200, true, "Lead fetched", { lead, followUps });
  } catch (error) {
    console.error("getLeadById error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── PATCH /api/leads/:id/status ────────────────────────────────────────────────
// NOTE: leadStatus is the workflow field. leadHealth is intentionally NOT
// touched here — it's independent and only updated via updateLeadDetails
// (or a dedicated leadHealth field, see updateLeadInfo below).
const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { leadStatus, remarks = "" } = req.body;

    const validStatuses = ["new", "contacted", "interested", "follow-up", "converted", "lost"];
    if (!validStatuses.includes(leadStatus)) {
      return send(res, 400, false, "Invalid status");
    }

    const filter   = applyScope({ _id: id }, counsellorScope(req));
    const existing = await Inquiry.findOne(filter);
    if (!existing) return send(res, 404, false, "Lead not found");

    const prevStatus = existing.leadStatus;

    const lead = await Inquiry.findOneAndUpdate(
      filter,
      { leadStatus, lastContactedAt: new Date() },
      { new: true }
    );

    if (prevStatus !== leadStatus) {
      logStatusChange(id, prevStatus, leadStatus, req.user, remarks);
    }

    return send(res, 200, true, "Status updated", lead);
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// ── PATCH /api/leads/:id/assign ────────────────────────────────────────────────
// Admin / Super Admin only — enforced at route level (isAdminOrSuper middleware)
const assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo, assignedToId: newCounsellorId, reason = "" } = req.body;

    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const existing = await Inquiry.findById(id);
    if (!existing) return send(res, 404, false, "Lead not found");

    let newCounsellor = null;
    if (newCounsellorId && isValidId(newCounsellorId)) {
      newCounsellor = await User.findById(newCounsellorId).select("fullName email role");
    }

    const prevCounsellorId = existing.assignedToId;
    let prevCounsellor = null;
    if (prevCounsellorId) {
      prevCounsellor = await User.findById(prevCounsellorId).select("fullName email");
    }

    const update = {
      assignedTo:   newCounsellor?.fullName || assignedTo || null,
      assignedToId: newCounsellor?._id      || null,
    };

    const lead = await Inquiry.findByIdAndUpdate(id, update, { new: true });

    logAssignment(
      id,
      prevCounsellor ? { id: prevCounsellor._id, name: prevCounsellor.fullName } : null,
      newCounsellor  ? { id: newCounsellor._id,  name: newCounsellor.fullName  } : null,
      req.user,
      reason
    );

    if (newCounsellor?._id) {
      notify({
        userId:            newCounsellor._id,
        type:              "lead_assigned",
        title:             "New lead assigned to you",
        body:              `${lead.fullName} (${lead.course}) has been assigned to you.`,
        link:              `/counsellor/leads/${lead._id}`,
        relatedResource:   "Inquiry",
        relatedResourceId: lead._id,
      });
    }

    return send(res, 200, true, "Lead assigned", lead);
  } catch (error) {
    console.error("assignLead error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── PATCH /api/leads/:id/priority ─────────────────────────────────────────────
const updateLeadPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!["low", "medium", "high", "urgent"].includes(priority)) {
      return send(res, 400, false, "Priority must be low, medium, high, or urgent");
    }
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const existing = await Inquiry.findOne(applyScope({ _id: id }, counsellorScope(req)));
    if (!existing) return send(res, 404, false, "Lead not found");

    const prevPriority = existing.priority;
    const lead = await Inquiry.findByIdAndUpdate(id, { priority }, { new: true });

    if (prevPriority !== priority) {
      appendTimeline(
        id, "priority_changed",
        `Priority changed from "${prevPriority}" to "${priority}"`,
        { from: prevPriority, to: priority },
        req.user
      );
    }

    return send(res, 200, true, "Priority updated", lead);
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// ── PATCH /api/leads/:id/demo ──────────────────────────────────────────────────
// demoScheduledAt now supports full date+time (datetime-local on the frontend);
// no backend change needed — Date() already stores time precision.
const updateDemoInfo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const {
      demoScheduledAt, demoMode, demoCompleted,
      demoFeedback, demoRating,
    } = req.body;

    const filter = applyScope({ _id: id }, counsellorScope(req));
    const update = {};

    if (demoScheduledAt !== undefined) update.demoScheduledAt = demoScheduledAt ? new Date(demoScheduledAt) : null;
    if (demoMode        !== undefined) update.demoMode        = demoMode;
    if (demoFeedback    !== undefined) update.demoFeedback    = demoFeedback;
    if (demoRating      !== undefined) update.demoRating      = demoRating;

    if (demoCompleted === true || demoCompleted === "true") {
      update.demoCompleted    = true;
      update.demoCompletedAt  = new Date();
    } else if (demoCompleted === false || demoCompleted === "false") {
      update.demoCompleted    = false;
      update.demoCompletedAt  = null;
    }

    if (Object.keys(update).length === 0) {
      return send(res, 400, false, "No demo fields provided");
    }

    const lead = await Inquiry.findOneAndUpdate(filter, { $set: update }, { new: true });
    if (!lead) return send(res, 404, false, "Lead not found");

    const isCompletion = update.demoCompleted === true;

    appendTimeline(
      id,
      isCompletion ? "demo_completed" : "demo_scheduled",
      isCompletion
        ? `Demo completed${demoRating ? ` — rating: ${demoRating}/5` : ""}`
        : `Demo scheduled for ${new Date(update.demoScheduledAt).toLocaleString("en-IN")} (${demoMode || "mode TBD"})`,
      update,
      req.user
    );

    return send(res, 200, true, isCompletion ? "Demo marked complete" : "Demo info updated", lead);
  } catch (error) {
    console.error("updateDemoInfo error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── PATCH /api/leads/:id/payment-plan ─────────────────────────────────────────
const updatePaymentPlan = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const {
      mode, emiMonths, downPayment, notes,
      negotiatedAmount, originalFee,
      reason = "", remarks = "",
    } = req.body;

    const filter   = applyScope({ _id: id }, counsellorScope(req));
    const existing = await Inquiry.findOne(filter);
    if (!existing) return send(res, 404, false, "Lead not found");

    const update = {};
    if (mode             !== undefined) update["paymentPlan.mode"]        = mode;
    if (emiMonths         !== undefined) update["paymentPlan.emiMonths"]   = emiMonths;
    if (downPayment       !== undefined) update["paymentPlan.downPayment"] = downPayment;
    if (notes             !== undefined) update["paymentPlan.notes"]      = notes;
    if (originalFee       !== undefined) update["fees.originalFee"]       = originalFee;

    let historyEntry = null;
    if (negotiatedAmount !== undefined) {
      const prevAmount = existing.fees?.negotiatedAmount ?? null;
      update["fees.negotiatedAmount"] = negotiatedAmount;

      if (prevAmount !== negotiatedAmount) {
        historyEntry = {
          previousAmount: prevAmount,
          newAmount:      negotiatedAmount,
          changedBy:      req.user.id,
          role:           req.user.role,
          reason,
          remarks,
          createdAt:      new Date(),
        };
      }
    }

    if (Object.keys(update).length === 0) {
      return send(res, 400, false, "No payment plan fields provided");
    }

    const mongoUpdate = { $set: update };
    if (historyEntry) {
      mongoUpdate.$push = { feeHistory: historyEntry };
    }

    const lead = await Inquiry.findOneAndUpdate(filter, mongoUpdate, { new: true })
      .populate("feeHistory.changedBy", "fullName email role");
    if (!lead) return send(res, 404, false, "Lead not found");

    appendTimeline(
      id, "info_updated",
      historyEntry
        ? `Fee updated: ₹${historyEntry.previousAmount ?? "—"} → ₹${historyEntry.newAmount}${reason ? ` — ${reason}` : ""}`
        : "Payment plan updated",
      update,
      req.user
    );

    return send(res, 200, true, "Payment plan updated", lead);
  } catch (error) {
    console.error("updatePaymentPlan error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── PATCH /api/leads/:id/parent-info ──────────────────────────────────────────
const updateParentInfo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const { fatherName, motherName, guardianName, guardianMobile } = req.body;
    const update = {};
    if (fatherName     !== undefined) update["parentInfo.fatherName"]     = fatherName;
    if (motherName     !== undefined) update["parentInfo.motherName"]     = motherName;
    if (guardianName   !== undefined) update["parentInfo.guardianName"]   = guardianName;
    if (guardianMobile !== undefined) update["parentInfo.guardianMobile"] = guardianMobile;

    if (Object.keys(update).length === 0) {
      return send(res, 400, false, "No parent info fields provided");
    }

    const filter = applyScope({ _id: id }, counsellorScope(req));
    const lead   = await Inquiry.findOneAndUpdate(filter, { $set: update }, { new: true });
    if (!lead) return send(res, 404, false, "Lead not found");

    appendTimeline(id, "info_updated", "Parent information updated", update, req.user);
    return send(res, 200, true, "Parent information updated", lead);
  } catch (error) {
    console.error("updateParentInfo error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// ── CONVERSION WORKFLOW ─────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────────
const requestConversion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const { note = "", finalFee = null } = req.body;

    const filter = applyScope({ _id: id }, counsellorScope(req));
    const lead   = await Inquiry.findOne(filter);
    if (!lead) return send(res, 404, false, "Lead not found");

    if (lead.leadStatus === "converted") {
      return send(res, 400, false, "This lead has already been converted", {
        studentId: lead.convertedStudentId,
      });
    }

    if (lead.conversionRequest?.status === "pending") {
      return send(res, 400, false, "A conversion request is already pending for this lead");
    }

    // ── Admin / Super Admin: convert immediately ────────────────────────────
    if (isApprover(req.user.role)) {
      await Inquiry.findByIdAndUpdate(id, {
        "conversionRequest.status":      "pending",
        "conversionRequest.requestedBy": req.user.id,
        "conversionRequest.requestedAt": new Date(),
        "conversionRequest.requestNote": note,
        "conversionRequest.finalFee":    finalFee,
      });

      const freshLead = await Inquiry.findById(id);
      const result = await performConversion(freshLead, req.user);

      return send(res, 201, true, "Lead converted to student successfully", result);
    }

    // ── Counsellor: create a pending request, do NOT convert ────────────────
    const updated = await Inquiry.findByIdAndUpdate(
      id,
      {
        "conversionRequest.status":          "pending",
        "conversionRequest.requestedBy":     req.user.id,
        "conversionRequest.requestedAt":     new Date(),
        "conversionRequest.requestNote":     note,
        "conversionRequest.finalFee":        finalFee,
        "conversionRequest.rejectionReason": "",
      },
      { new: true }
    );

    appendTimeline(
      id, "conversion_requested",
      `${req.user.fullName || "Counsellor"} requested conversion to student${finalFee ? ` — final fee: ₹${finalFee}` : ""}`,
      { note, finalFee },
      req.user
    );

    const admins = await User.find({ role: { $in: ["admin", "super_admin"] }, isActive: true }).select("_id");
    notifyMany(
      admins.map((a) => a._id),
      {
        type:              "conversion_requested",
        title:             "New conversion request",
        body:              `${updated.fullName} (${updated.course}) — requested by ${req.user.fullName || "a counsellor"}.`,
        link:              `/admin/leads/${updated._id}`,
        relatedResource:   "Inquiry",
        relatedResourceId: updated._id,
      }
    );

    return send(res, 201, true, "Conversion request submitted — awaiting admin approval", updated);
  } catch (error) {
    console.error("requestConversion error:", error);
    return send(res, 500, false, "Server error");
  }
};

// PATCH /api/leads/:id/conversion-request/approve  — admin / super_admin only
const approveConversionRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const lead = await Inquiry.findById(id);
    if (!lead) return send(res, 404, false, "Lead not found");

    if (lead.leadStatus === "converted") {
      return send(res, 400, false, "This lead has already been converted");
    }
    if (lead.conversionRequest?.status !== "pending") {
      return send(res, 400, false, "There is no pending conversion request for this lead");
    }

    const result = await performConversion(lead, req.user);

    if (lead.conversionRequest?.requestedBy) {
      notify({
        userId:            lead.conversionRequest.requestedBy,
        type:              "conversion_approved",
        title:             "Conversion request approved",
        body:              `${lead.fullName} has been converted to a student.`,
        link:              `/counsellor/leads/${lead._id}`,
        relatedResource:   "Inquiry",
        relatedResourceId: lead._id,
      });
    }

    return send(res, 200, true, "Conversion request approved — student created", result);
  } catch (error) {
    console.error("approveConversionRequest error:", error);
    if (error.code === 11000) return send(res, 409, false, "Email already registered");
    return send(res, 500, false, "Server error");
  }
};

// PATCH /api/leads/:id/conversion-request/reject  — admin / super_admin only
const rejectConversionRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const { rejectionReason = "" } = req.body;
    if (!rejectionReason.trim()) {
      return send(res, 400, false, "rejectionReason is required");
    }

    const lead = await Inquiry.findById(id);
    if (!lead) return send(res, 404, false, "Lead not found");

    if (lead.conversionRequest?.status !== "pending") {
      return send(res, 400, false, "There is no pending conversion request for this lead");
    }

    const updated = await Inquiry.findByIdAndUpdate(
      id,
      {
        "conversionRequest.status":          "rejected",
        "conversionRequest.rejectedBy":      req.user.id,
        "conversionRequest.rejectedAt":      new Date(),
        "conversionRequest.rejectionReason": rejectionReason,
      },
      { new: true }
    );

    appendTimeline(
      id, "conversion_rejected",
      `Conversion request rejected — ${rejectionReason}`,
      { rejectionReason },
      req.user
    );

    if (lead.conversionRequest?.requestedBy) {
      notify({
        userId:            lead.conversionRequest.requestedBy,
        type:              "conversion_rejected",
        title:             "Conversion request rejected",
        body:              `${lead.fullName}'s conversion was rejected: ${rejectionReason}`,
        link:              `/counsellor/leads/${lead._id}`,
        relatedResource:   "Inquiry",
        relatedResourceId: lead._id,
      });
    }

    return send(res, 200, true, "Conversion request rejected", updated);
  } catch (error) {
    console.error("rejectConversionRequest error:", error);
    return send(res, 500, false, "Server error");
  }
};

// GET /api/leads/conversion-requests/pending — admin / super_admin only
const getPendingConversionRequests = async (req, res) => {
  try {
   const leads = await Inquiry.find({ "conversionRequest.status": "pending" })
  .populate("conversionRequest.requestedBy", "fullName email role")
  .populate("assignedToId", "fullName email")
  .populate("course", "title slug category")
  .sort({ "conversionRequest.requestedAt": -1 });
    return send(res, 200, true, "Pending conversion requests fetched", leads, {
      count: leads.length,
    });
  } catch (error) {
    console.error("getPendingConversionRequests error:", error);
    return send(res, 500, false, "Server error");
  }
};

// Backward-compat alias: old frontend code may still call /convert directly.
const convertToStudent = requestConversion;

// ── POST /api/leads/:id/lost ───────────────────────────────────────────────────
const markLeadLost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const { lostReason = "", competitor = "", remarks = "" } = req.body;

    const filter   = applyScope({ _id: id }, counsellorScope(req));
    const existing = await Inquiry.findOne(filter);
    if (!existing) return send(res, 404, false, "Lead not found");

    const prevStatus = existing.leadStatus;

    const lead = await Inquiry.findOneAndUpdate(
      filter,
      {
        leadStatus:  "lost",
        lostReason,
        competitor,
        lostAt:      new Date(),
        lostBy:      req.user.id,
        remarks:     remarks || existing.remarks,
      },
      { new: true }
    );

    logStatusChange(id, prevStatus, "lost", req.user, lostReason);
    appendTimeline(
      id, "lost",
      `Lead marked as lost${lostReason ? ` — ${lostReason}` : ""}${competitor ? ` (went with: ${competitor})` : ""}`,
      { lostReason, competitor, remarks },
      req.user
    );

    return send(res, 200, true, "Lead marked as lost", lead);
  } catch (error) {
    console.error("markLeadLost error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── GET /api/leads/duplicates/check ───────────────────────────────────────────
const checkDuplicates = async (req, res) => {
  try {
    const { mobile, email } = req.query;

    if (!mobile && !email) {
      return send(res, 400, false, "Provide at least one of: mobile, email");
    }

    const conditions = [];
    if (mobile) conditions.push({ mobileNumber: mobile.trim() });
    if (email)  conditions.push({ email: email.trim().toLowerCase() });

    const duplicates = await Inquiry.find({ $or: conditions })
      .select("fullName mobileNumber email course leadStatus createdAt assignedTo assignedToId")
      .populate("assignedToId", "fullName")
      .sort({ createdAt: -1 })
      .limit(10);

    return send(res, 200, true, "Duplicate check complete", duplicates, {
      hasDuplicates: duplicates.length > 0,
      count: duplicates.length,
    });
  } catch (error) {
    console.error("checkDuplicates error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── POST /api/leads/merge ──────────────────────────────────────────────────────
const mergeLeads = async (req, res) => {
  try {
    const { sourceId, targetId, reason = "" } = req.body;

    if (!isValidId(sourceId) || !isValidId(targetId)) {
      return send(res, 400, false, "Invalid sourceId or targetId");
    }
    if (sourceId === targetId) {
      return send(res, 400, false, "sourceId and targetId must be different");
    }

    const [source, target] = await Promise.all([
      Inquiry.findById(sourceId),
      Inquiry.findById(targetId),
    ]);
    if (!source) return send(res, 404, false, "Source lead not found");
    if (!target) return send(res, 404, false, "Target lead not found");

    await LeadFollowUp.updateMany({ leadId: sourceId }, { leadId: targetId });

    if (source.documents?.length) {
      const existingUrls = new Set(target.documents.map((d) => d.url));
      const newDocs = source.documents.filter((d) => !existingUrls.has(d.url));
      if (newDocs.length) {
        await Inquiry.findByIdAndUpdate(targetId, { $push: { documents: { $each: newDocs } } });
      }
    }

    if (source.feeHistory?.length) {
      await Inquiry.findByIdAndUpdate(targetId, { $push: { feeHistory: { $each: source.feeHistory } } });
    }

    await Inquiry.findByIdAndUpdate(sourceId, {
      leadStatus: "lost",
      lostReason: `Merged into lead ${targetId}. ${reason}`.trim(),
      lostAt:     new Date(),
      lostBy:     req.user.id,
    });

    appendTimeline(
      targetId, "info_updated",
      `Merged with duplicate lead (${source.fullName} / ${source.mobileNumber})`,
      { mergedFromId: sourceId, reason },
      req.user
    );

    appendTimeline(
      sourceId, "lost",
      `Lead merged into ${targetId} and closed`,
      { mergedIntoId: targetId, reason },
      req.user
    );

    const merged = await Inquiry.findById(targetId);
    return send(res, 200, true, "Leads merged successfully", merged);
  } catch (error) {
    console.error("mergeLeads error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── GET /api/leads/:id/timeline ────────────────────────────────────────────────
const getLeadTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    if (req.user.role === "counsellor") {
      const lead = await Inquiry.findOne(applyScope({ _id: id }, counsellorScope(req))).select("_id");
      if (!lead) return send(res, 404, false, "Lead not found");
    }

    const [timeline, followUps] = await Promise.all([
      LeadTimeline.find({ leadId: id }).sort({ createdAt: -1 }).limit(100),
      LeadFollowUp.find({ leadId: id }).sort({ createdAt: -1 }),
    ]);

    return send(res, 200, true, "Timeline fetched", { timeline, followUps });
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// ── GET /api/leads/:id/fee-history ─────────────────────────────────────────────
const getFeeHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const filter = applyScope({ _id: id }, counsellorScope(req));
    const lead = await Inquiry.findOne(filter)
      .select("feeHistory fees")
      .populate("feeHistory.changedBy", "fullName email role");

    if (!lead) return send(res, 404, false, "Lead not found");

    const sorted = [...lead.feeHistory].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return send(res, 200, true, "Fee history fetched", sorted, { currentFees: lead.fees });
  } catch (error) {
    console.error("getFeeHistory error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── GET /api/leads/:id/status-history ─────────────────────────────────────────
const getStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const history = await LeadStatusHistory.find({ leadId: id }).sort({ createdAt: -1 });
    return send(res, 200, true, "Status history fetched", history);
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// ── GET /api/leads/:id/assign-history ─────────────────────────────────────────
const getAssignmentHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const history = await LeadAssignmentHistory.find({ leadId: id }).sort({ createdAt: -1 });
    return send(res, 200, true, "Assignment history fetched", history);
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// ── GET /api/leads/analytics/counsellor ───────────────────────────────────────
// NEW: includes `byHealth` — counts per leadHealth bucket, independent of
// leadStatus workflow stats which remain unchanged.
const getCounsellorAnalytics = async (req, res) => {
  try {
    const isCounsellorRole = req.user.role === "counsellor";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const scopeFilter = isCounsellorRole ? counsellorScope(req) : {};

    const [
      totalLeads, myLeads, converted, lost,
      followUpDueToday, overdueFollowUps,
      demosToday, contacted, pendingConversions,
      healthCounts,
    ] = await Promise.all([
      Inquiry.countDocuments({ ...scopeFilter }),
      isCounsellorRole ? Inquiry.countDocuments(scopeFilter) : null,
      Inquiry.countDocuments({ ...scopeFilter, leadStatus: "converted" }),
      Inquiry.countDocuments({ ...scopeFilter, leadStatus: "lost" }),
      Inquiry.countDocuments({
        ...scopeFilter,
        nextFollowUpDate: { $gte: today, $lt: tomorrow },
        leadStatus: { $nin: ["converted", "lost"] },
      }),
      Inquiry.countDocuments({
        ...scopeFilter,
        nextFollowUpDate: { $lt: today },
        leadStatus: { $nin: ["converted", "lost"] },
      }),
      Inquiry.countDocuments({
        ...scopeFilter,
        demoScheduledAt: { $gte: today, $lt: tomorrow },
      }),
      Inquiry.countDocuments({ ...scopeFilter, leadStatus: "contacted" }),
      Inquiry.countDocuments({ ...scopeFilter, "conversionRequest.status": "pending" }),
      Inquiry.aggregate([
        { $match: scopeFilter },
        { $group: { _id: "$leadHealth", count: { $sum: 1 } } },
      ]),
    ]);

    const total          = totalLeads;
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

    const byHealth = LEAD_HEALTH_OPTIONS.reduce((acc, h) => {
      acc[h] = healthCounts.find((c) => c._id === h)?.count || 0;
      return acc;
    }, {});

    if (!isCounsellorRole) {
      const counsellorStats = await Inquiry.aggregate([
        { $match: { assignedToId: { $ne: null } } },
        {
          $group: {
            _id:        "$assignedToId",
            total:      { $sum: 1 },
            converted:  { $sum: { $cond: [{ $eq: ["$leadStatus", "converted"] }, 1, 0] } },
            lost:       { $sum: { $cond: [{ $eq: ["$leadStatus", "lost"] }, 1, 0] } },
            followUpDue: {
              $sum: {
                $cond: [
                  { $and: [
                    { $gte: ["$nextFollowUpDate", today] },
                    { $lt:  ["$nextFollowUpDate", tomorrow] },
                  ]},
                  1, 0,
                ],
              },
            },
          },
        },
        {
          $lookup: {
            from:         "users",
            localField:   "_id",
            foreignField: "_id",
            as:           "counsellor",
          },
        },
        { $unwind: { path: "$counsellor", preserveNullAndEmpty: true } },
        {
          $project: {
            counsellorId:   "$_id",
            name:           "$counsellor.fullName",
            email:          "$counsellor.email",
            total:          1,
            converted:      1,
            lost:           1,
            followUpDue:    1,
            conversionRate: {
              $cond: [
                { $gt: ["$total", 0] },
                { $multiply: [{ $divide: ["$converted", "$total"] }, 100] },
                0,
              ],
            },
          },
        },
        { $sort: { converted: -1 } },
      ]);

      return send(res, 200, true, "Analytics fetched", {
        overview: {
          total, converted, lost, conversionRate,
          followUpDueToday, overdueFollowUps, demosToday, contacted, pendingConversions,
        },
        byCounsellor: counsellorStats,
        byHealth,
      });
    }

    return send(res, 200, true, "Your analytics", {
      myLeads:         myLeads ?? total,
      converted,
      lost,
      conversionRate,
      followUpDueToday,
      overdueFollowUps,
      demosToday,
      contacted,
      pendingConversions,
      byHealth,
    });
  } catch (error) {
    console.error("getCounsellorAnalytics error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ─── Other existing handlers (unchanged) ────────────────────────────────────────

// updateLeadInfo also accepts a standalone `leadHealth` change (e.g. from a
// quick-set dropdown in the UI that isn't part of the full edit form).
const updateLeadInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { fees, parentInfo, branch, demoCompleted, leadHealth } = req.body;

    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const update = {};
    if (fees !== undefined) {
      if (fees.min !== undefined) update["fees.min"] = fees.min;
      if (fees.max !== undefined) update["fees.max"] = fees.max;
      if (fees.negotiatedAmount !== undefined) update["fees.negotiatedAmount"] = fees.negotiatedAmount;
      if (fees.originalFee !== undefined) update["fees.originalFee"] = fees.originalFee;
    }
    if (parentInfo !== undefined) {
      if (parentInfo.name     !== undefined) update["parentInfo.name"]     = parentInfo.name;
      if (parentInfo.relation !== undefined) update["parentInfo.relation"] = parentInfo.relation;
      if (parentInfo.fatherName     !== undefined) update["parentInfo.fatherName"]     = parentInfo.fatherName;
      if (parentInfo.motherName     !== undefined) update["parentInfo.motherName"]     = parentInfo.motherName;
      if (parentInfo.guardianName   !== undefined) update["parentInfo.guardianName"]   = parentInfo.guardianName;
      if (parentInfo.guardianMobile !== undefined) update["parentInfo.guardianMobile"] = parentInfo.guardianMobile;
    }
    if (branch          !== undefined) update.branch          = branch;
    if (demoCompleted   !== undefined) {
      update.demoCompleted   = demoCompleted;
      update.demoCompletedAt = demoCompleted ? new Date() : null;
    }
    if (leadHealth !== undefined) {
      if (!LEAD_HEALTH_OPTIONS.includes(leadHealth)) {
        return send(res, 400, false, "Invalid leadHealth value");
      }
      update.leadHealth = leadHealth;
    }

    if (Object.keys(update).length === 0) {
      return send(res, 400, false, "No valid fields provided");
    }

    const filter = applyScope({ _id: id }, counsellorScope(req));
    const lead   = await Inquiry.findOneAndUpdate(filter, { $set: update }, { new: true });
    if (!lead) return send(res, 404, false, "Lead not found");

    appendTimeline(
      id, "info_updated",
      leadHealth !== undefined ? `Lead health changed to "${leadHealth}"` : "Lead info updated",
      update,
      req.user
    );
    return send(res, 200, true, "Lead info updated", lead);
  } catch (error) {
    console.error("updateLeadInfo error:", error);
    return send(res, 500, false, "Server error");
  }
};

const updateObjections = async (req, res) => {
  try {
    const { id } = req.params;
    const { objections } = req.body;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");
    if (!Array.isArray(objections)) return send(res, 400, false, "objections must be an array");

    const filter = applyScope({ _id: id }, counsellorScope(req));
    const lead   = await Inquiry.findOneAndUpdate(filter, { objections }, { new: true });
    if (!lead) return send(res, 404, false, "Lead not found");

    appendTimeline(id, "objections_updated", `Objections updated (${objections.length} item(s))`, { objections }, req.user);
    return send(res, 200, true, "Objections updated", lead);
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

const addDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, type } = req.body;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");
    if (!name || !url) return send(res, 400, false, "name and url are required");

    const filter = applyScope({ _id: id }, counsellorScope(req));
    const lead   = await Inquiry.findOneAndUpdate(
      filter,
      { $push: { documents: { name, url, type: type || null, uploadedAt: new Date() } } },
      { new: true }
    );
    if (!lead) return send(res, 404, false, "Lead not found");

    appendTimeline(id, "document_added", `Document added: ${name}`, { name, url, type }, req.user);
    return send(res, 201, true, "Document added", lead);
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

const removeDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const filter = applyScope({ _id: id }, counsellorScope(req));
    const lead   = await Inquiry.findOneAndUpdate(
      filter,
      { $pull: { documents: { _id: docId } } },
      { new: true }
    );
    if (!lead) return send(res, 404, false, "Lead not found");

    appendTimeline(id, "document_removed", `Document removed (ID: ${docId})`, { docId }, req.user);
    return send(res, 200, true, "Document removed", lead);
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// createFollowUp — nextFollowUpDate now carries full date+time precision
// (frontend sends a datetime-local value). No backend change needed since
// Date() already preserves time; comment added for clarity only.
const createFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { contactedBy, communicationType, note, nextFollowUpDate } = req.body;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const filter = applyScope({ _id: id }, counsellorScope(req));
    const lead   = await Inquiry.findOne(filter);
    if (!lead) return send(res, 404, false, "Lead not found");

    const followUp = await LeadFollowUp.create({
      leadId: id, contactedBy, communicationType, note,
      nextFollowUpDate: nextFollowUpDate || null,
    });

    await Inquiry.findByIdAndUpdate(id, {
      lastContactedAt:  new Date(),
      nextFollowUpDate: nextFollowUpDate || lead.nextFollowUpDate,
      leadStatus:       "follow-up",
    });

    appendTimeline(
      id, "followup_added",
      `Follow-up added via ${communicationType} by ${contactedBy}${
        nextFollowUpDate ? ` — next: ${new Date(nextFollowUpDate).toLocaleString("en-IN")}` : ""
      }`,
      { followUpId: followUp._id, communicationType, nextFollowUpDate },
      req.user
    );

    return send(res, 201, true, "Follow-up created", followUp);
  } catch (error) {
    console.error("createFollowUp error:", error);
    return send(res, 500, false, "Server error");
  }
};

const getFollowUps = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === "counsellor") {
      const lead = await Inquiry.findOne(applyScope({ _id: id }, counsellorScope(req))).select("_id");
      if (!lead) return send(res, 404, false, "Lead not found");
    }
    const followUps = await LeadFollowUp.find({ leadId: id }).sort({ createdAt: -1 });
    return send(res, 200, true, "Follow-ups fetched", followUps);
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// const getLeadDashboard = async (req, res) => {
//   try {
//     const scope = counsellorScope(req);
//     const [total, newLeads, contacted, followUpPending, converted, lost, pendingConversions, healthCounts] = await Promise.all([
//       Inquiry.countDocuments({ ...scope }),
//       Inquiry.countDocuments({ ...scope, leadStatus: "new" }),
//       Inquiry.countDocuments({ ...scope, leadStatus: "contacted" }),
//       Inquiry.countDocuments({ ...scope, leadStatus: "follow-up" }),
//       Inquiry.countDocuments({ ...scope, leadStatus: "converted" }),
//       Inquiry.countDocuments({ ...scope, leadStatus: "lost" }),
//       Inquiry.countDocuments({ ...scope, "conversionRequest.status": "pending" }),
//       Inquiry.aggregate([
//         { $match: scope },
//         { $group: { _id: "$leadHealth", count: { $sum: 1 } } },
//       ]),
//     ]);
//     const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

//     const byHealth = LEAD_HEALTH_OPTIONS.reduce((acc, h) => {
//       acc[h] = healthCounts.find((c) => c._id === h)?.count || 0;
//       return acc;
//     }, {});

//     return send(res, 200, true, "Dashboard fetched", {
//       totalLeads: total, newLeads, contactedLeads: contacted,
//       followUpsPending: followUpPending, convertedLeads: converted,
//       lostLeads: lost, conversionRate, pendingConversions,
//       byHealth,
//     });
//   } catch (error) {
//     return send(res, 500, false, "Server error");
//   }
// };


const getLeadDashboard = async (req, res) => {
  try {
    const { search = "", status = "", course = "", leadHealth = "" } = req.query;

    // Base filter excludes status so each status bucket can still be computed;
    // Total additionally applies status when the caller explicitly filtered by it.
    const baseFilter = applyScope(
      buildLeadFilterQuery({ search, course, leadHealth }),
      counsellorScope(req)
    );
    // const totalFilter = status ? { ...baseFilter, leadStatus: status } : baseFilter;

        const totalFilter = status ? applyStatusFilter({ ...baseFilter }, status) : baseFilter;

    const [total, newLeads, contacted, followUpPending, converted, lost, pendingConversions, healthCounts] = await Promise.all([
      Inquiry.countDocuments(totalFilter),
      Inquiry.countDocuments({ ...baseFilter, leadStatus: "new" }),
      Inquiry.countDocuments({ ...baseFilter, leadStatus: "contacted" }),
      Inquiry.countDocuments({ ...baseFilter, leadStatus: "follow-up" }),
      Inquiry.countDocuments({ ...baseFilter, leadStatus: "converted" }),
      Inquiry.countDocuments({ ...baseFilter, leadStatus: "lost" }),
      Inquiry.countDocuments({ ...baseFilter, "conversionRequest.status": "pending" }),
      Inquiry.aggregate([
        { $match: baseFilter },
        { $group: { _id: "$leadHealth", count: { $sum: 1 } } },
      ]),
    ]);
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

    const byHealth = LEAD_HEALTH_OPTIONS.reduce((acc, h) => {
      acc[h] = healthCounts.find((c) => c._id === h)?.count || 0;
      return acc;
    }, {});

    return send(res, 200, true, "Dashboard fetched", {
      totalLeads: total, newLeads, contactedLeads: contacted,
      followUpsPending: followUpPending, convertedLeads: converted,
      lostLeads: lost, conversionRate, pendingConversions,
      byHealth,
    });
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// const getAllFollowUps = async (req, res) => {
//   try {
//     const { filter = "all" } = req.query;
//     const scope = counsellorScope(req);
//     const today    = new Date(); today.setHours(0, 0, 0, 0);
//     const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
//     const weekEnd  = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
//     let dateQuery = {};
//     if (filter === "today")    dateQuery = { nextFollowUpDate: { $gte: today, $lt: tomorrow } };
//     else if (filter === "tomorrow") dateQuery = { nextFollowUpDate: { $gte: tomorrow, $lt: new Date(tomorrow.getTime() + 86400000) } };
//     else if (filter === "week")    dateQuery = { nextFollowUpDate: { $gte: today, $lt: weekEnd } };
//     else if (filter === "overdue") dateQuery = { nextFollowUpDate: { $lt: today } };
//     const leads = await Inquiry.find({
//       ...scope, nextFollowUpDate: { $ne: null }, ...dateQuery,
//     }).sort({ nextFollowUpDate: 1 });
//     return send(res, 200, true, "Follow-ups fetched", leads);
//   } catch (error) {
//     return send(res, 500, false, "Server error");
//   }
// };

// updateLeadDetails — NOW accepts leadHealth alongside the standard editable
// fields. leadHealth is validated against LEAD_HEALTH_OPTIONS and is fully
// independent of leadStatus (the workflow field) — updating one never
// touches the other.
// const updateLeadDetails = async (req, res) => {
//   try {
//     const { id } = req.params;
//     // if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

//     if (course !== undefined) {
//   if (!isValidId(course)) return send(res, 400, false, "Invalid course selected");
//   const courseExists = await Course.findById(course).select("_id");
//   if (!courseExists) return send(res, 400, false, "Selected course does not exist");
//   update.course = course;
// }

//     const { fullName, mobileNumber, email, course, source, remarks, leadHealth } = req.body;
//     const update = {};
//     if (fullName     !== undefined) update.fullName     = fullName.trim();
//     if (mobileNumber !== undefined) update.mobileNumber = mobileNumber.trim();
//     if (email         !== undefined) update.email        = email ? email.toLowerCase().trim() : "";
//     if (course        !== undefined) update.course       = course;
//     if (source        !== undefined) update.source       = source;
//     if (remarks        !== undefined) update.remarks      = remarks;
//     if (leadHealth     !== undefined) {
//       if (!LEAD_HEALTH_OPTIONS.includes(leadHealth)) {
//         return send(res, 400, false, "Invalid leadHealth value");
//       }
//       update.leadHealth = leadHealth;
//     }

//     if (Object.keys(update).length === 0) {
//       return send(res, 400, false, "No valid fields provided");
//     }

//     const filter = applyScope({ _id: id }, counsellorScope(req));

//     const lead = await Inquiry.findOneAndUpdate(filter, { $set: update }, { new: true });
//     if (!lead) return send(res, 404, false, "Lead not found");

//     appendTimeline(
//       id, "info_updated",
//       leadHealth !== undefined ? `Lead details edited (health → "${leadHealth}")` : "Lead details edited",
//       update,
//       req.user
//     );
//     return send(res, 200, true, "Lead details updated", lead);
//   } catch (error) {
//     console.error("updateLeadDetails error:", error);
//     if (error.code === 11000) return send(res, 409, false, "Duplicate lead detected");
//     return send(res, 500, false, "Server error");
//   }
// };
const getAllFollowUps = async (req, res) => {
  try {
    const { filter = "all" } = req.query;
    const scope = counsellorScope(req);
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd  = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
    let dateQuery = {};
    if (filter === "today")    dateQuery = { nextFollowUpDate: { $gte: today, $lt: tomorrow } };
    else if (filter === "tomorrow") dateQuery = { nextFollowUpDate: { $gte: tomorrow, $lt: new Date(tomorrow.getTime() + 86400000) } };
    else if (filter === "week")    dateQuery = { nextFollowUpDate: { $gte: today, $lt: weekEnd } };
    else if (filter === "overdue") dateQuery = { nextFollowUpDate: { $lt: today } };

    const leads = await Inquiry.find({
      ...scope,
      nextFollowUpDate: { $ne: null },
      leadStatus: { $nin: ["converted", "lost"] }, // NEW — consistent with dashboard widget
      ...dateQuery,
    }).sort({ nextFollowUpDate: 1 });

    return send(res, 200, true, "Follow-ups fetched", leads);
  } catch (error) {
    console.error("getAllFollowUps error:", error);
    return send(res, 500, false, "Server error");
  }
};

const updateLeadDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const { fullName, mobileNumber, email, course, source, remarks, leadHealth } = req.body;
    const update = {};

    if (fullName     !== undefined) update.fullName     = fullName.trim();
    if (mobileNumber !== undefined) update.mobileNumber = mobileNumber.trim();
    if (email        !== undefined) update.email        = email ? email.toLowerCase().trim() : "";

    if (course !== undefined) {
      if (!isValidId(course)) return send(res, 400, false, "Invalid course selected");
      const courseExists = await Course.findById(course).select("_id");
      if (!courseExists) return send(res, 400, false, "Selected course does not exist");
      update.course = course;
    }

    if (source   !== undefined) update.source  = source;
    if (remarks  !== undefined) update.remarks = remarks;
    if (leadHealth !== undefined) {
      if (!LEAD_HEALTH_OPTIONS.includes(leadHealth)) {
        return send(res, 400, false, "Invalid leadHealth value");
      }
      update.leadHealth = leadHealth;
    }

    if (Object.keys(update).length === 0) {
      return send(res, 400, false, "No valid fields provided");
    }

    const filter = applyScope({ _id: id }, counsellorScope(req));
    const lead = await Inquiry.findOneAndUpdate(filter, { $set: update }, { new: true });
    if (!lead) return send(res, 404, false, "Lead not found");

    appendTimeline(
      id, "info_updated",
      leadHealth !== undefined ? `Lead details edited (health → "${leadHealth}")` : "Lead details edited",
      update,
      req.user
    );
    return send(res, 200, true, "Lead details updated", lead);
  } catch (error) {
    console.error("updateLeadDetails error:", error);
    if (error.code === 11000) return send(res, 409, false, "Duplicate lead detected");
    return send(res, 500, false, "Server error");
  }
};

// ── DELETE /api/leads/:id — admin / super_admin only ───────────────────────────
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const lead = await Inquiry.findByIdAndDelete(id);
    if (!lead) return send(res, 404, false, "Lead not found");

    appendTimeline(id, "info_updated", `Lead deleted by ${req.user.fullName || "admin"}`, {}, req.user);
    return send(res, 200, true, "Lead deleted");
  } catch (error) {
    console.error("deleteLead error:", error);
    return send(res, 500, false, "Server error");
  }
};


// ── PATCH /api/leads/:id/assign-fee-collection ────────────────────────────────
// Admin / Super Admin only. Independent from the lead counsellor (assignedToId).
const assignFeeCollectionCounsellor = async (req, res) => {
  try {
    const { id } = req.params;
    const { feeCollectionCounsellorId, reason = "" } = req.body;

    if (!isValidId(id)) return send(res, 400, false, "Invalid lead ID");

    const lead = await Inquiry.findById(id);
    if (!lead) return send(res, 404, false, "Lead not found");

    let counsellor = null;
    if (feeCollectionCounsellorId) {
      if (!isValidId(feeCollectionCounsellorId)) {
        return send(res, 400, false, "Invalid counsellor ID");
      }
      counsellor = await User.findById(feeCollectionCounsellorId).select("fullName email role isActive");
      if (!counsellor) return send(res, 404, false, "Counsellor not found");
    }

    const update = {
      feeCollectionCounsellor:   counsellor?.fullName || null,
      feeCollectionCounsellorId: counsellor?._id || null,
    };

    const updated = await Inquiry.findByIdAndUpdate(id, update, { new: true });

    appendTimeline(
      id, "info_updated",
      counsellor
        ? `Fee collection counsellor assigned: ${counsellor.fullName}${reason ? ` — ${reason}` : ""}`
        : "Fee collection counsellor unassigned",
      { ...update, reason },
      req.user
    );

    // If this lead already has a linked student, propagate immediately —
    // don't wait for a re-conversion that will never happen.
    if (updated.convertedStudentId) {
      await User.findByIdAndUpdate(updated.convertedStudentId, {
        feeCollectionCounsellor: counsellor?._id || null,
      });
    }

    if (counsellor?._id) {
      notify({
        userId:            counsellor._id,
        type:              "lead_assigned",
        title:             "Fee collection assigned to you",
        body:              `${updated.fullName} (${updated.course}) has been assigned to you for fee collection follow-ups.`,
        link:              updated.convertedStudentId
          ? `/counsellor/fee-collection/${updated.convertedStudentId}`
          : `/admin/leads/${updated._id}`,
        relatedResource:   "Inquiry",
        relatedResourceId: updated._id,
      });
    }

    return send(res, 200, true, "Fee collection counsellor updated", updated);
  } catch (error) {
    console.error("assignFeeCollectionCounsellor error:", error);
    return send(res, 500, false, "Server error");
  }
};


// ── POST /api/leads/bulk-delete — admin / super_admin only ────────────────────
const bulkDeleteLeads = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return send(res, 400, false, "Provide an array of lead IDs to delete");
    }

    const validIds = ids.filter((id) => isValidId(id));
    if (validIds.length === 0) {
      return send(res, 400, false, "No valid lead IDs provided");
    }

    const result = await Inquiry.deleteMany({ _id: { $in: validIds } });

    validIds.forEach((id) => {
      appendTimeline(
        id, "info_updated",
        `Lead deleted by ${req.user.fullName || "admin"} (bulk delete)`,
        {}, req.user
      );
    });

    return send(res, 200, true, `${result.deletedCount} lead(s) deleted`, {
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("bulkDeleteLeads error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── PATCH /api/leads/bulk-assign — admin / super_admin only ───────────────────
// body: { ids: string[], assignedToId: string | null }
const bulkAssignLeads = async (req, res) => {
  try {
    const { ids, assignedToId } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return send(res, 400, false, "Provide an array of lead IDs to assign");
    }

    const validIds = ids.filter((id) => isValidId(id));
    if (validIds.length === 0) {
      return send(res, 400, false, "No valid lead IDs provided");
    }

    let counsellor = null;
    if (assignedToId) {
      if (!isValidId(assignedToId)) return send(res, 400, false, "Invalid counsellor ID");
      counsellor = await User.findById(assignedToId).select("fullName email role isActive");
      if (!counsellor) return send(res, 404, false, "Counsellor not found");
    }

    // Fetch current assignment so we can log a proper before/after history entry per lead
    const leads = await Inquiry.find({ _id: { $in: validIds } }).select("_id assignedToId fullName course");

    const update = {
      assignedTo: counsellor?.fullName || null,
      assignedToId: counsellor?._id || null,
    };

    await Inquiry.updateMany({ _id: { $in: validIds } }, update);

    // Resolve previous-counsellor names in one batch to avoid N queries
    const prevIds = [...new Set(leads.filter((l) => l.assignedToId).map((l) => String(l.assignedToId)))];
    const prevUsers = prevIds.length
      ? await User.find({ _id: { $in: prevIds } }).select("fullName")
      : [];
    const prevMap = new Map(prevUsers.map((u) => [String(u._id), u.fullName]));

    leads.forEach((lead) => {
      const prevName = lead.assignedToId ? prevMap.get(String(lead.assignedToId)) : null;
      logAssignment(
        lead._id,
        lead.assignedToId ? { id: lead.assignedToId, name: prevName || "Unknown" } : null,
        counsellor ? { id: counsellor._id, name: counsellor.fullName } : null,
        req.user,
        "Bulk assignment"
      );
    });

    if (counsellor?._id) {
      notify({
        userId: counsellor._id,
        type: "lead_assigned",
        title: "Multiple leads assigned to you",
        body: `${validIds.length} lead(s) have been assigned to you.`,
        link: `/counsellor/leads`,
        relatedResource: "Inquiry",
        relatedResourceId: null,
      });
    }

    return send(res, 200, true, `${validIds.length} lead(s) assigned successfully`, {
      updatedCount: validIds.length,
    });
  } catch (error) {
    console.error("bulkAssignLeads error:", error);
    return send(res, 500, false, "Server error");
  }
};


// ── GET /api/leads/export ─────────────────────────────────────────────────────
// Exports ALL leads matching the current filters.
// No pagination is applied.
const exportLeads = async (req, res) => {
  try {
    const {
      search = "",
      status = "",
      course = "",
      priority = "",
      source = "",
      assignedToId = "",
      unassigned = "",
      leadHealth = "",
    } = req.query;

    // Use the exact same filters as the normal leads listing
    let query = buildLeadFilterQuery({
      search,
      status,
      course,
      leadHealth,
    });

    if (priority) query.priority = priority;
    if (source) query.source = source;

    if (assignedToId && isValidId(assignedToId)) {
      query.assignedToId = assignedToId;
    }

    if (unassigned === "true") {
      query.assignedToId = null;
    }

    // Keep counsellor visibility rules identical to GET /api/leads
    query = applyScope(query, counsellorScope(req));

    const leads = await Inquiry.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .populate("assignedToId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .populate("course", "title slug category")
      .lean();

    const escapeCsv = (value) => {
      if (value === null || value === undefined) return "";

      const stringValue = String(value)
        .replace(/\r?\n|\r/g, " ")
        .trim();

      return `"${stringValue.replace(/"/g, '""')}"`;
    };

    const formatDate = (value) => {
      if (!value) return "";
      return new Date(value).toLocaleString("en-IN");
    };

    const rows = leads.map((lead) => ({
      Name: lead.fullName || "",
      Phone: lead.mobileNumber || "",
      Email: lead.email || "",
      Course: lead.course?.title || "",
      Status: lead.leadStatus || "",
      Health: lead.leadHealth || "",
      Priority: lead.priority || "",
      Source: lead.source || "",
      "Assigned To": lead.assignedToId?.fullName || lead.assignedTo || "",
      "Created By": lead.createdBy?.fullName || "",
      "Next Follow Up": formatDate(lead.nextFollowUpDate),
      "Created At": formatDate(lead.createdAt),
      Remarks: lead.remarks || "",
    }));

    const headers = [
      "Name",
      "Phone",
      "Email",
      "Course",
      "Status",
      "Health",
      "Priority",
      "Source",
      "Assigned To",
      "Created By",
      "Next Follow Up",
      "Created At",
      "Remarks",
    ];

    const csv = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) =>
        headers.map((header) => escapeCsv(row[header])).join(",")
      ),
    ].join("\r\n");

    // UTF-8 BOM makes Hindi/Unicode text open correctly in Excel
    const csvWithBom = "\uFEFF" + csv;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="leads-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`
    );

    return res.status(200).send(csvWithBom);
  } catch (error) {
    console.error("exportLeads error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export leads",
    });
  }
};



const getDashboardPendingFollowUps = async (req, res) => {
  try {
    const scope = counsellorScope(req);
    const now = new Date();

    const leads = await Inquiry.find({
      ...scope,
      nextFollowUpDate: { $ne: null },
      leadStatus: { $nin: ["converted", "lost"] },
    })
      .select("fullName course nextFollowUpDate leadStatus assignedTo assignedToId")
      .populate("course", "title slug category")
      .lean();

    const withFlag = leads.map((l) => ({
      ...l,
      isOverdue: new Date(l.nextFollowUpDate) < now,
    }));

    // Overdue items sorted nearest-to-now first (most urgent/relevant),
    // then upcoming items sorted soonest-first. Overdue always leads
    // since it's still pending and needs attention.
    withFlag.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      const aTime = new Date(a.nextFollowUpDate).getTime();
      const bTime = new Date(b.nextFollowUpDate).getTime();
      return a.isOverdue ? bTime - aTime : aTime - bTime;
    });

    return send(res, 200, true, "Pending follow-ups fetched", withFlag.slice(0, 5));
  } catch (error) {
    console.error("getDashboardPendingFollowUps error:", error);
    return send(res, 500, false, "Server error");
  }
};


module.exports = {
  createLead,              
  getAllLeads,
  getLeadById,
  updateLeadStatus,
  assignLead,
  updateLeadInfo,
  updateObjections,
  addDocument,
  removeDocument,
  createFollowUp,
  getFollowUps,
  getLeadDashboard,
  getAllFollowUps,
  updateLeadPriority,
  updateDemoInfo,
  updatePaymentPlan,
  updateParentInfo,
  getFeeHistory,
  convertToStudent,
  requestConversion,
  approveConversionRequest,
  rejectConversionRequest,
  getPendingConversionRequests,
  markLeadLost,
  checkDuplicates,
  mergeLeads,
  getLeadTimeline,
  getStatusHistory,
  getAssignmentHistory,
  getCounsellorAnalytics,
  updateLeadDetails,
  deleteLead,
  assignFeeCollectionCounsellor,
   bulkDeleteLeads,
  bulkAssignLeads,
  exportLeads,
  getDashboardPendingFollowUps,
};


