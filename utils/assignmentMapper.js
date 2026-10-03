// utils/assignmentMapper.js
//
// StudentAssignment ab mentor ko User collection se populate karta hai
// (role: "mentor"). User schema mein field naam "fullName" hai, "designation"
// hai — lekin frontend abhi bhi legacy Mentor-shape (.name, .specialization)
// expect karta hai. Yeh helper populate ke baad ek compatible alias bana deta hai.

const normalizeAssignment = (assignmentDoc) => {
  if (!assignmentDoc) return assignmentDoc;

  const obj = typeof assignmentDoc.toObject === "function"
    ? assignmentDoc.toObject()
    : assignmentDoc;

  if (obj.mentor && typeof obj.mentor === "object" && obj.mentor._id) {
    obj.mentor = {
      ...obj.mentor,
      name: obj.mentor.fullName || obj.mentor.name || "",
      specialization: obj.mentor.designation || obj.mentor.specialization || "",
    };
  }

  return obj;
};

module.exports = { normalizeAssignment };