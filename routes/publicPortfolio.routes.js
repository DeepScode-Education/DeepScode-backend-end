const express = require("express");

const router = express.Router();

const { getPublicPortfolios } = require("../controllers/portfolio.controller");

/*
|--------------------------------------------------------------------------
| Public Portfolio Showcase Route
|--------------------------------------------------------------------------
| No auth — only published projects are ever returned (enforced in the
| service layer via filter = { status: "published" }).
*/

router.get("/", getPublicPortfolios);

module.exports = router;