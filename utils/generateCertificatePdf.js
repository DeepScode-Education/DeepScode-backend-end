// utils/generateCertificatePdf.js
//
// Generates the official Slate Academy certificate PDF by embedding the
// provided certificate template PDF (a real vector file, not a raster
// image) as the background, then overlaying the dynamic student/course/
// date/certificate-ID values on top at the positions defined in certificateLayout.js. No QR code is generated anywhere in this file.
//
// Uses pdf-lib (not PDFKit) because pdf-lib can embed another PDF's page
// directly, preserving the template's vector quality (sharp text/logo/
// seal at any zoom level) instead of flattening it to a JPEG/PNG first.
//
// Returns a Buffer — the caller (certificate.controller.js) uploads it to
// Cloudinary and stores the resulting URL on the Certificate document.

const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

// The certificate template PDF lives in /backend/assets.
const TEMPLATE_PATH = path.join(__dirname, "..", "assets", "certificate.pdf");

const LAYOUT = require("./certificateLayout");

/**
 * Reusable text fitter: shrinks the font until `text` fits `maxWidth`
 * (never below `minSize`). If it still doesn't fit at `minSize`, the text is
 * truncated with an ellipsis so it can never overflow into other content.
 */
function fitText(font, text, { maxSize, minSize, maxWidth }) {
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return { text, size };
  }
  let truncated = text;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}...`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return { text: `${truncated.trimEnd()}...`, size };
}

// Draw a horizontally centred, auto-fitted line of text on its baseline.
// Layout values are top-origin; pdf-lib is bottom-origin, so flip Y here.
function drawCentered(page, font, field, text, color) {
  const fitted = fitText(font, text, field);
  const width = font.widthOfTextAtSize(fitted.text, fitted.size);
  page.drawText(fitted.text, {
    x: field.centerX - width / 2,
    y: page.getHeight() - field.baseline,
    size: fitted.size,
    font,
    color,
  });
}

// "cyber-security-ethical-hacking" -> "CYBER SECURITY & ETHICAL HACKING"
const formatCourseName = (name) =>
  String(name || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\band\b/gi, "&")
    .toUpperCase();

const formatIssueDate = (issueDate) =>
  new Date(issueDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

/**
 * @param {Object} data
 * @param {string} data.studentName
 * @param {string} data.courseName
 * @param {string} data.certificateId
 * @param {Date|string} data.issueDate
 * @returns {Promise<Buffer>}
 */
const generateCertificatePdf = async ({ studentName, courseName, certificateId, issueDate }) => {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(
      `Certificate template PDF not found at ${TEMPLATE_PATH}. ` +
        "Add it as backend/assets/certificate.pdf."
    );
  }

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const templateDoc = await PDFDocument.load(templateBytes);
  const { width, height } = templateDoc.getPages()[0].getSize();

  const pdfDoc = await PDFDocument.create();
  const [embeddedTemplatePage] = await pdfDoc.embedPdf(templateBytes, [0]);

  const page = pdfDoc.addPage([width, height]);
  page.drawPage(embeddedTemplatePage, {
    x: 0,
    y: 0,
    width,
    height,
  });

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const dark = rgb(0.043, 0.09, 0.184); // template navy
  const brandBlue = rgb(0.165, 0.294, 0.878); // matches template course highlight
  const grey = rgb(0.35, 0.38, 0.45);

  // Student name (centred, on the name rule, below the "PRESENTED TO" line).
  const name = String(studentName || "").replace(/\s+/g, " ").trim();
  const nameField = LAYOUT.studentName;
  drawCentered(page, boldFont, nameField, nameField.uppercase ? name.toUpperCase() : name, dark);

  // Course: hide the template's baked-in sample course, then redraw.
  const { mask, ...courseField } = LAYOUT.courseName;
  page.drawRectangle({
    x: mask.x,
    y: height - mask.top - mask.height,
    width: mask.width,
    height: mask.height,
    color: rgb(1, 1, 1),
  });
  const intro = LAYOUT.courseIntro;
  drawCentered(page, regularFont, { ...intro, maxSize: intro.size, minSize: intro.size, maxWidth: 300 }, intro.text, grey);
  drawCentered(page, boldFont, courseField, formatCourseName(courseName), brandBlue);

  // Issue date (on the DATE OF ISSUE rule).
  drawCentered(page, boldFont, LAYOUT.issueDate, formatIssueDate(issueDate), dark);

  // Certificate number (bottom centre, away from signatures/affiliations).
  const cn = LAYOUT.certificateNumber;
  drawCentered(page, regularFont, cn, `${cn.prefix}${certificateId}`, grey);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};

module.exports = generateCertificatePdf;