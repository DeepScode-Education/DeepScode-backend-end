const LINK_TYPES = [
  "Personal Website", "LinkedIn", "GitHub", "Behance", "Dribbble",
  "ArtStation", "YouTube", "Vimeo", "Google Drive", "Live Project",
  "Resume", "Other",
];

const isValidUrl = (str) => {
  if (typeof str !== "string" || !str.trim()) return false;
  try {
    const u = new URL(str.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const sanitizeLinks = (links) => {
  if (!Array.isArray(links)) return [];
  return links
    .map((l) => ({
      type: (l?.type || "").trim(),
      label: (l?.label || "").trim(),
      url: (l?.url || "").trim(),
    }))
    .filter((l) => l.url || l.type);
};

const validateLinks = (links) => {
  const errors = [];
  links.forEach((l, i) => {
    const position = `Link ${i + 1}`;
    if (!l.type) return errors.push(`${position}: link type is required`);
    if (!LINK_TYPES.includes(l.type)) return errors.push(`${position}: "${l.type}" is not a supported link type`);
    if (l.type === "Other" && !l.label) errors.push(`${position}: a custom label is required when type is "Other"`);
    if (!l.url) errors.push(`${position}: URL is required`);
    else if (!isValidUrl(l.url)) errors.push(`${position}: "${l.url}" is not a valid URL`);
  });
  return errors;
};

module.exports = { LINK_TYPES, isValidUrl, sanitizeLinks, validateLinks };