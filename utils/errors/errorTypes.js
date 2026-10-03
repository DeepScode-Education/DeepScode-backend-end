// // utils/errors/errorTypes.js
// //
// // One class per error *category*. Throw the most specific one that fits —
// // the centralized handler (middleware/errorHandler.middleware.js) uses
// // `errorCode` + `statusCode` to build a clean response, and the frontend
// // can branch on `errorCode` if it ever needs to (e.g. redirect to login on
// // AUTHENTICATION_ERROR).
// //
// // All of these are "operational" errors — expected, safe-to-display-message
// // situations. Anything else (a genuine bug/crash) is NOT one of these and
// // gets normalized generically by the error handler.

// const AppError = require("./AppError");

// /** 400 — request body/params failed validation */
// class ValidationError extends AppError {
//   constructor(message = "The information provided is invalid.", details = null) {
//     super(message, 400, "VALIDATION_ERROR", details);
//   }
// }

// /** 400 — request is malformed / references something that doesn't make sense */
// class BadRequestError extends AppError {
//   constructor(message = "This request could not be processed.", details = null) {
//     super(message, 400, "BAD_REQUEST", details);
//   }
// }

// /** 401 — no/invalid/expired credentials */
// class AuthenticationError extends AppError {
//   constructor(message = "Please log in to continue.", details = null) {
//     super(message, 401, "AUTHENTICATION_ERROR", details);
//   }
// }

// /** 403 — logged in, but not allowed to do this */
// class AuthorizationError extends AppError {
//   constructor(message = "You do not have permission to perform this action.", details = null) {
//     super(message, 403, "AUTHORIZATION_ERROR", details);
//   }
// }

// /** 404 — the thing being looked up doesn't exist */
// class NotFoundError extends AppError {
//   constructor(message = "The requested item could not be found.", details = null) {
//     super(message, 404, "NOT_FOUND", details);
//   }
// }

// /** 409 — unique-constraint / already-exists conflicts */
// class DuplicateError extends AppError {
//   constructor(message = "A record with these details already exists.", details = null) {
//     super(message, 409, "DUPLICATE_ERROR", details);
//   }
// }

// /** 400 — multer / file-selection problems (wrong type, too large, missing file) */
// class FileUploadError extends AppError {
//   constructor(message = "The file could not be uploaded.", details = null) {
//     super(message, 400, "FILE_UPLOAD_ERROR", details);
//   }
// }

// /** 502 — the file was fine, but the Cloudinary round-trip failed */
// class CloudinaryError extends AppError {
//   constructor(message = "The media storage service failed to process this file. Please try again.", details = null) {
//     super(message, 502, "CLOUDINARY_ERROR", details);
//   }
// }

// /** 500 — MongoDB rejected/failed the operation (not the same as bad input) */
// class DatabaseError extends AppError {
//   constructor(message = "A database error occurred. Please try again in a moment.", details = null) {
//     super(message, 500, "DATABASE_ERROR", details);
//   }
// }



// /** 500 — Zoom (or other third-party) integration is missing required configuration */
// class ZoomConfigError extends AppError {
//   constructor(message = "The live class service is not configured correctly. Please contact support.", details = null) {
//     super(message, 500, "ZOOM_CONFIG_ERROR", details);
//   }
// }

// /** 502 — Zoom's API rejected or failed to process a request */
// class ZoomAPIError extends AppError {
//   constructor(message = "The live class service (Zoom) failed to process this request. Please try again.", details = null) {
//     super(message, 502, "ZOOM_API_ERROR", details);
//   }
// }

// module.exports = {
//   ValidationError,
//   BadRequestError,
//   AuthenticationError,
//   AuthorizationError,
//   NotFoundError,
//   DuplicateError,
//   FileUploadError,
//   CloudinaryError,
//   DatabaseError,
//   ZoomConfigError,   
//   ZoomAPIError,    
// };



// utils/errors/errorTypes.js
//
// One class per error *category*. Throw the most specific one that fits —
// the centralized handler (middleware/errorHandler.middleware.js) uses
// `errorCode` + `statusCode` to build a clean response, and the frontend
// can branch on `errorCode` if it ever needs to (e.g. redirect to login on
// AUTHENTICATION_ERROR).
//
// All of these are "operational" errors — expected, safe-to-display-message
// situations. Anything else (a genuine bug/crash) is NOT one of these and
// gets normalized generically by the error handler.

const AppError = require("./AppError");

/** 400 — request body/params failed validation */
class ValidationError extends AppError {
  constructor(message = "The information provided is invalid.", details = null) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

/** 400 — request is malformed / references something that doesn't make sense */
class BadRequestError extends AppError {
  constructor(message = "This request could not be processed.", details = null) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

/** 401 — no/invalid/expired credentials */
class AuthenticationError extends AppError {
  constructor(message = "Please log in to continue.", details = null) {
    super(message, 401, "AUTHENTICATION_ERROR", details);
  }
}

/** 403 — logged in, but not allowed to do this */
class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action.", details = null) {
    super(message, 403, "AUTHORIZATION_ERROR", details);
  }
}

/** 404 — the thing being looked up doesn't exist */
class NotFoundError extends AppError {
  constructor(message = "The requested item could not be found.", details = null) {
    super(message, 404, "NOT_FOUND", details);
  }
}

/** 409 — unique-constraint / already-exists conflicts */
class DuplicateError extends AppError {
  constructor(message = "A record with these details already exists.", details = null) {
    super(message, 409, "DUPLICATE_ERROR", details);
  }
}

/** 400 — multer / file-selection problems (wrong type, too large, missing file) */
class FileUploadError extends AppError {
  constructor(message = "The file could not be uploaded.", details = null) {
    super(message, 400, "FILE_UPLOAD_ERROR", details);
  }
}

/** 502 — the file was fine, but the Cloudinary round-trip failed */
class CloudinaryError extends AppError {
  constructor(message = "The media storage service failed to process this file. Please try again.", details = null) {
    super(message, 502, "CLOUDINARY_ERROR", details);
  }
}

/** 500 — MongoDB rejected/failed the operation (not the same as bad input) */
class DatabaseError extends AppError {
  constructor(message = "A database error occurred. Please try again in a moment.", details = null) {
    super(message, 500, "DATABASE_ERROR", details);
  }
}



/** 500 — Zoom (or other third-party) integration is missing required configuration */
class ZoomConfigError extends AppError {
  constructor(message = "The live class service is not configured correctly. Please contact support.", details = null) {
    super(message, 500, "ZOOM_CONFIG_ERROR", details);
  }
}

/** 502 — Zoom's API rejected or failed to process a request */
class ZoomAPIError extends AppError {
  constructor(message = "The live class service (Zoom) failed to process this request. Please try again.", details = null) {
    super(message, 502, "ZOOM_API_ERROR", details);
  }
}

/** 500 — Google Drive integration is missing required service-account configuration */
class GoogleDriveConfigError extends AppError {
  constructor(message = "The video storage service is not configured correctly. Please contact support.", details = null) {
    super(message, 500, "GOOGLE_DRIVE_CONFIG_ERROR", details);
  }
}

/** 502 — Google Drive's API rejected or failed to process a request */
class GoogleDriveAPIError extends AppError {
  constructor(message = "The video storage service (Google Drive) failed to process this request. Please try again.", details = null) {
    super(message, 502, "GOOGLE_DRIVE_API_ERROR", details);
  }
}

module.exports = {
  ValidationError,
  BadRequestError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DuplicateError,
  FileUploadError,
  CloudinaryError,
  DatabaseError,
  ZoomConfigError,
  ZoomAPIError,
  GoogleDriveConfigError,
  GoogleDriveAPIError,
};