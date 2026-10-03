// utils/certificateLayout.js
//
// Layout configuration for assets/certificate.pdf (A4 portrait, 595 x 842 pt).
// All values are in PDF points and measured from the TOP-LEFT of the page,
// taken from the rendered template (not from the old certificate-template.pdf).
//
// Template landmarks (top-origin, pt):
//   "THIS CERTIFICATE IS PROUDLY PRESENTED TO" ... y 365.0 - 370.8
//   student-name underline ...................... y 412.2, x 141.2 - 449.5
//   baked-in course sentence, line 1 ............ y 439.5 - 448.0 (x 170.5 - 414.2)
//   baked-in sentence, lines 2 / 3 .............. y 452.5 - 460.8 / 465.0 - 473.5
//   DATE OF ISSUE rule / label .................. y 586.8 / 593 - 598, x 129.5 - 190.2
//   ACADEMIC DIRECTOR rule / label .............. y 586.8 / 593 - 598, x 401.5 - 462.5
//   artwork bottom edge ......................... y ~631
//
// `baseline` is the text baseline. `centerX` is the horizontal centre of the
// field. `maxWidth` is the widest the text may get before the font shrinks.

const CENTER_X = 295.5; // optical centre of the white content area

module.exports = {
  // Static text sits at y 365-371 and the name rule at y 412, so the name is
  // placed on the rule with clear space above it.
  studentName: {
    centerX: CENTER_X,
    baseline: 404,
    maxWidth: 300,
    maxSize: 18,
    minSize: 8,
    uppercase: true,
  },

  // The template has "for successfully completing the Motion Graphics
  // Program" baked in as raster art. The course slot (line 1) is masked and
  // redrawn: the intro phrase goes in the free band under the name rule, the
  // dynamic course name takes the line-1 slot. Lines 2/3 are left untouched.
  courseIntro: {
    centerX: CENTER_X,
    baseline: 428,
    text: "for successfully completing the",
    size: 9.5,
  },
  courseName: {
    centerX: CENTER_X,
    baseline: 447.5,
    maxWidth: 340,
    maxSize: 14,
    minSize: 8,
    // white patch that hides the baked-in "Motion Graphics Program" line only
    mask: { x: 120, top: 436.5, width: 350, height: 14 },
  },

  // Sits on the DATE OF ISSUE rule (centre x 159.9, rule at y 586.8).
  issueDate: {
    centerX: 159.9,
    baseline: 582.5,
    maxWidth: 110,
    maxSize: 10,
    minSize: 7,
  },

  // Dedicated, unobtrusive spot: bottom centre, below the labels row and
  // clear of Date of Issue / Academic Director / affiliations.
  certificateNumber: {
    centerX: CENTER_X,
    baseline: 617,
    maxWidth: 220,
    maxSize: 8,
    minSize: 6,
    prefix: "Certificate ID: ",
  },
};