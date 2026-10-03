// modules/live-class/routes/liveClass.routes.js

const express = require("express");
const router = express.Router();

const { auth, isMentor, isStudent } = require("../../../middleware/auth.middleware");
const controller = require("../controllers/liveClass.controller");
const { startClassRules, liveClassIdRules, validate } = require("../validators/liveClass.validator");

router.use(auth);

router.post("/start", isMentor, startClassRules, validate, controller.startClass);
router.post("/end", isMentor, liveClassIdRules, validate, controller.endClass);
router.post("/join", liveClassIdRules, validate, controller.joinClass);

router.get("/current", controller.getCurrent);
router.get("/history", controller.getHistory);
router.get("/upcoming", controller.getUpcoming);

router.post("/attendance/heartbeat", isStudent, liveClassIdRules, validate, controller.attendanceHeartbeat);

router.post("/host-heartbeat", isMentor, liveClassIdRules, validate, controller.mentorHeartbeat);

module.exports = router;