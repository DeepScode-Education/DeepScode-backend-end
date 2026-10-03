const admin = (req, res, next) => {
  console.log("Admin Check:", req.user);

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access Denied",
    });
  }

  next();
};

module.exports = admin;