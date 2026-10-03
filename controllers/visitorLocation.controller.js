// controllers/visitorLocation.controller.js
const IpLog = require("../models/IpLog");
const { getVisitorIdFromRequest } = require("../utils/cookieHelper");

const isValidCoordinate = (lat, lng) =>
  typeof lat === "number" &&
  !Number.isNaN(lat) &&
  typeof lng === "number" &&
  !Number.isNaN(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

/**
 * POST /api/visitor/location
 *
 * Called by the frontend ONLY after the browser's Geolocation API has
 * actually granted permission and returned real coordinates. If
 * permission is denied/unavailable, the frontend should simply never
 * call this endpoint — nothing here assumes location data exists, and no
 * visit record is ever blocked or altered by its absence.
 *
 * The visitor is identified purely by the httpOnly `svid` cookie that
 * visitorTracker middleware already set on their page load — never by
 * anything the client claims about its own identity in the request body.
 */
const updateVisitorLocation = async (req, res) => {
  try {
    const visitorId = getVisitorIdFromRequest(req);
    if (!visitorId) {
      return res.status(400).json({
        success: false,
        message: "No visitor session found for this request.",
      });
    }

    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    const rawAccuracy = req.body.accuracy;
    const accuracy =
      rawAccuracy !== undefined && rawAccuracy !== null && Number.isFinite(Number(rawAccuracy))
        ? Number(rawAccuracy)
        : null;

    if (!isValidCoordinate(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required.",
      });
    }

    // Attach the location to this visitor's most recent page-view record.
    const lastVisit = await IpLog.findOne({ visitorId }).sort({ visitedAt: -1 });

    if (!lastVisit) {
      return res.status(404).json({
        success: false,
        message: "No visit record found to attach location to.",
      });
    }

    lastVisit.location = {
      latitude,
      longitude,
      accuracy,
      collectedAt: new Date(),
    };
    await lastVisit.save();

    return res.status(200).json({
      success: true,
      message: "Location recorded.",
    });
  } catch (error) {
    console.error("updateVisitorLocation error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { updateVisitorLocation };