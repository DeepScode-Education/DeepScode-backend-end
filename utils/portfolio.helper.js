/**
 * Generate Portfolio Slug
 */

const generateSlug = (title) => {
  return title

    .toLowerCase()

    .trim()

    .replace(/[^a-z0-9]+/g, "-")

    .replace(/^-+|-+$/g, "");
};

/**
 * Check Project Link Available
 */

const hasProjectLink = (portfolio) => {
  const links = [
    portfolio.githubUrl,

    portfolio.liveUrl,

    portfolio.figmaUrl,

    portfolio.behanceUrl,

    portfolio.videoUrl,

    portfolio.driveUrl,
  ];

  return links.some((link) => link && link.trim() !== "");
};

/**
 * Format Cloudinary Image
 */

const formatImage = (file) => {
  if (!file) {
    return null;
  }

  return {
    url: file.path,

    publicId: file.filename,
  };
};

/**
 * Format Multiple Images
 */

const formatGallery = (files) => {
  if (!files || files.length === 0) {
    return [];
  }

  return files.map((file) => ({
    url: file.path,

    publicId: file.filename,
  }));
};

/**
 * Remove Empty Values
 */

const removeEmptyFields = (obj) => {
  return Object.fromEntries(
    Object.entries(obj)

      .filter(
        ([_, value]) => value !== "" && value !== null && value !== undefined,
      ),
  );
};

module.exports = {
  generateSlug,

  hasProjectLink,

  formatImage,

  formatGallery,

  removeEmptyFields,
};
