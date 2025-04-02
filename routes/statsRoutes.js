// routes/statsRoutes.js
const express = require("express");
const router = express.Router();
const { getStatistics } = require("../controllers/statistics"); // Correct import

router.get("/", getStatistics); // Simplified path to avoid redundancy

module.exports = router;