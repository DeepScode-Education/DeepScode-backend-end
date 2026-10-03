const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const {
  getProfile,
  upsertProfile,
} = require("../controllers/staffProfile.controller");

router.get("/me", auth, requirePermission("profile.view"), (req, res) => {
  req.params.id = req.user.id;
  return getProfile(req, res);
});

router.put("/me", auth, requirePermission("profile.edit"), (req, res) => {
  req.params.id = req.user.id;
  return upsertProfile(req, res);
});

router.get("/:id", auth, requirePermission("employees.view"), getProfile);
router.put("/:id", auth, requirePermission("employees.edit"), upsertProfile);

module.exports = router;
