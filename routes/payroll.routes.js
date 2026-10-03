const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const {
  getPayroll,
  getPayrollById,
  createPayroll,
  updatePayroll,
} = require("../controllers/staffPayroll.controller");

router.use(auth);
router.get("/", requirePermission("payroll.view"), getPayroll);
router.get("/:id", requirePermission("payroll.view"), getPayrollById);
router.post("/", requirePermission("payroll.manage"), createPayroll);
router.put("/:id", requirePermission("payroll.manage"), updatePayroll);

module.exports = router;
