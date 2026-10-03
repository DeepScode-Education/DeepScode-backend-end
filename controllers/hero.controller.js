// const HeroSlide = require("../models/HeroSlide");
// const uploadToCloudinary = require("../utils/uploadToCloudinary");
// const { redisClient } = require("../config/redis");

// const CACHE_KEY = "hero:slides";
// const CACHE_TTL_SECONDS = 300;

// // ── Safe Redis wrappers ───────────────────────────────────────────────────────
// // redisClient.isReady is the correct check (not isOpen)
// // isOpen = socket open, isReady = fully connected + authenticated

// const isRedisReady = () => {
//   try {
//     return redisClient.isReady;
//   } catch {
//     return false;
//   }
// };

// const redisGet = async (key) => {
//   try {
//     if (!isRedisReady()) return null;
//     return await redisClient.get(key);
//   } catch (err) {
//     console.error("Redis GET error:", err.message);
//     return null;
//   }
// };

// const redisSetEx = async (key, ttl, value) => {
//   try {
//     if (!isRedisReady()) return;
//     await redisClient.setEx(key, ttl, value);
//   } catch (err) {
//     console.error("Redis SETEX error:", err.message);
//   }
// };

// const redisDel = async (key) => {
//   try {
//     if (!isRedisReady()) return;
//     await redisClient.del(key);
//   } catch (err) {
//     console.error("Redis DEL error:", err.message);
//   }
// };

// const invalidateCache = () => redisDel(CACHE_KEY);

// // ── CREATE HERO SLIDE (ADMIN) ─────────────────────────────────────────────────

// const createHeroSlide = async (req, res) => {
//   try {
//     const { title, subtitle, order } = req.body;

//     let imageUrl = "";
//     if (req.file) {
//       const result = await uploadToCloudinary(req.file.buffer, "hero-slides");
//       imageUrl = result.secure_url;
//     }

//     const slide = await HeroSlide.create({ title, subtitle, order, image: imageUrl });

//     await invalidateCache();

//     res.json({ success: true, data: slide });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ── GET HERO SLIDES (PUBLIC) ──────────────────────────────────────────────────

// // const getHeroSlides = async (req, res) => {
// //   try {
// //     // 1. Try Redis (safe — falls back to DB if not ready)
// //     const cached = await redisGet(CACHE_KEY);
// //     if (cached) {
// //       return res
// //         // .set("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
// //         // .set("X-Cache", "HIT")
// //         // .json({ success: true, data: JSON.parse(cached) });

        
// // return res
// //   .set("Cache-Control", "no-cache")   // was: "public, max-age=300, stale-while-revalidate=60"
// //   .set("X-Cache", cached ? "HIT" : "MISS")
// //   .json({ success: true, data: slides });
// //     }

// //     // 2. MongoDB fallback
// //     const slides = await HeroSlide.find({ isActive: true }).sort({ order: 1 }).lean();

// //     // 3. Store in Redis (best-effort)
// //     await redisSetEx(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(slides));

// //     return res
// //       .set("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
// //       .set("X-Cache", "MISS")
// //       .json({ success: true, data: slides });
// //   } catch (err) {
// //     res.status(500).json({ success: false, message: err.message });
// //   }
// // };

// const getHeroSlides = async (req, res) => {
//   try {
//     // 1. Try Redis
//     const cached = await redisGet(CACHE_KEY);
//     if (cached) {
//       return res
//         .set("Cache-Control", "no-cache")
//         .set("X-Cache", "HIT")
//         .json({ success: true, data: JSON.parse(cached) });
//     }

//     // 2. MongoDB fallback
//     const slides = await HeroSlide.find({ isActive: true }).sort({ order: 1 }).lean();

//     // 3. Store in Redis (best-effort)
//     await redisSetEx(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(slides));

//     return res
//       .set("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
//       .set("X-Cache", "MISS")
//       .json({ success: true, data: slides });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ── UPDATE HERO SLIDE (ADMIN) ─────────────────────────────────────────────────

// const updateHeroSlide = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { title, subtitle, order, isActive } = req.body;

//     const updateData = { title, subtitle, order, isActive };
//     if (req.file) {
//       const result = await uploadToCloudinary(req.file.buffer, "hero-slides");
//       updateData.image = result.secure_url;
//     }

//     const updated = await HeroSlide.findByIdAndUpdate(id, updateData, { new: true });
//     if (!updated) return res.status(404).json({ success: false, message: "Slide not found" });

//     await invalidateCache();

//     res.json({ success: true, data: updated });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ── DELETE HERO SLIDE (ADMIN) ─────────────────────────────────────────────────

// const deleteHeroSlide = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const deleted = await HeroSlide.findByIdAndDelete(id);
//     if (!deleted) return res.status(404).json({ success: false, message: "Slide not found" });

//     await invalidateCache();

//     res.json({ success: true, message: "Deleted successfully" });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// module.exports = { createHeroSlide, getHeroSlides, updateHeroSlide, deleteHeroSlide };



const HeroSlide = require("../models/HeroSlide");
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const deleteFromCloudinary = uploadToCloudinary.deleteFromCloudinary;
const { redisClient } = require("../config/redis");

const CACHE_KEY = "hero:slides";
const CACHE_TTL_SECONDS = 300;

// ── Safe Redis wrappers ────────────────────────────────────────────────────
const isRedisReady = () => {
  try {
    return redisClient.isReady;
  } catch {
    return false;
  }
};

const redisGet = async (key) => {
  try {
    if (!isRedisReady()) return null;
    return await redisClient.get(key);
  } catch (err) {
    console.error("Redis GET error:", err.message);
    return null;
  }
};

const redisSetEx = async (key, ttl, value) => {
  try {
    if (!isRedisReady()) return;
    await redisClient.setEx(key, ttl, value);
  } catch (err) {
    console.error("Redis SETEX error:", err.message);
  }
};

const redisDel = async (key) => {
  try {
    if (!isRedisReady()) return;
    await redisClient.del(key);
  } catch (err) {
    console.error("Redis DEL error:", err.message);
  }
};

const invalidateCache = () => redisDel(CACHE_KEY);

// ── CREATE HERO SLIDE (ADMIN) ───────────────────────────────────────────────
const createHeroSlide = async (req, res) => {
  try {
    const { title, subtitle, order } = req.body;

    let imageUrl = "";
    let imagePublicId = "";
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "hero-slides");
      imageUrl = result.secure_url;
      imagePublicId = result.public_id;
    }

    const slide = await HeroSlide.create({
      title,
      subtitle,
      order,
      image: imageUrl,
      imagePublicId,
    });

    await invalidateCache();

    res.json({ success: true, data: slide });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET HERO SLIDES (PUBLIC) ────────────────────────────────────────────────
// NOTE: no Cache-Control override here anymore. server.js's global
// middleware already sets `no-store, no-cache, must-revalidate` on every
// response, which is exactly right for this endpoint — Redis is the speed
// layer (hit = a few ms), the HTTP layer must never let a browser or CDN
// hold onto stale hero data on top of that. The previous
// `public, max-age=300, stale-while-revalidate=60` on cache-miss responses
// silently overrode that global no-store policy and was the main reason
// edits could take up to 5 minutes to show up for other visitors.
const getHeroSlides = async (req, res) => {
  try {
    const cached = await redisGet(CACHE_KEY);
    if (cached) {
      return res.set("X-Cache", "HIT").json({ success: true, data: JSON.parse(cached) });
    }

    const slides = await HeroSlide.find({ isActive: true }).sort({ order: 1 }).lean();

    await redisSetEx(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(slides));

    return res.set("X-Cache", "MISS").json({ success: true, data: slides });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPDATE HERO SLIDE (ADMIN) ───────────────────────────────────────────────
// Handles both PUT (full edit, may include a new image file) and PATCH
// (publish/draft toggle, JSON body only — see routes).
const updateHeroSlide = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, order, isActive } = req.body;

    const existing = await HeroSlide.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Slide not found" });
    }

    const updateData = { title, subtitle, order, isActive };
    let oldPublicId = null;

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "hero-slides");
      updateData.image = result.secure_url;
      updateData.imagePublicId = result.public_id;
      oldPublicId = existing.imagePublicId;
    }

    const updated = await HeroSlide.findByIdAndUpdate(id, updateData, { new: true });

    await invalidateCache();

    // Delete the OLD Cloudinary asset only after the DB (and cache) have
    // already switched over to the new one — so there's never a window
    // where a served page could point at an asset we're deleting.
    if (oldPublicId) {
      deleteFromCloudinary(oldPublicId);
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE HERO SLIDE (ADMIN) ───────────────────────────────────────────────
const deleteHeroSlide = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await HeroSlide.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "Slide not found" });

    await invalidateCache();

    if (deleted.imagePublicId) {
      deleteFromCloudinary(deleted.imagePublicId);
    }

    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createHeroSlide, getHeroSlides, updateHeroSlide, deleteHeroSlide };