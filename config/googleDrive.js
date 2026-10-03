const { google } = require("googleapis");
const { Readable } = require("stream");
const {
  GoogleDriveConfigError,
  GoogleDriveAPIError,
} = require("../utils/errors/errorTypes");

const SCOPES = ["https://www.googleapis.com/auth/drive"];

let cachedDriveClient = null;

const validateEnv = () => {
  const missing = [];

  if (!process.env.GOOGLE_DRIVE_CLIENT_ID)
    missing.push("GOOGLE_DRIVE_CLIENT_ID");

  if (!process.env.GOOGLE_DRIVE_CLIENT_SECRET)
    missing.push("GOOGLE_DRIVE_CLIENT_SECRET");

  if (!process.env.GOOGLE_DRIVE_REFRESH_TOKEN)
    missing.push("GOOGLE_DRIVE_REFRESH_TOKEN");

  if (!process.env.GOOGLE_DRIVE_FOLDER_ID)
    missing.push("GOOGLE_DRIVE_FOLDER_ID");

  if (missing.length) {
    throw new GoogleDriveConfigError(
      `Google Drive is not configured on the server: missing ${missing.join(
        ", "
      )}.`,
      { missing }
    );
  }
};

const getDriveClient = () => {
  if (cachedDriveClient) return cachedDriveClient;

  validateEnv();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    "http://localhost"
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  });

  cachedDriveClient = google.drive({
    version: "v3",
    auth: oauth2Client,
  });

  return cachedDriveClient;
};

const bufferToStream = (buffer) => {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
};

const uploadVideoToDrive = async ({ buffer, mimeType, fileName }) => {
  const drive = getDriveClient();

  try {
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType,
        body: bufferToStream(buffer),
      },
      fields: "id, name, mimeType, size",
    });

    return {
      driveFileId: res.data.id,
      fileName: res.data.name,
      mimeType: res.data.mimeType,
      fileSize: res.data.size ? Number(res.data.size) : buffer.length,
    };
  } catch (err) {
    throw new GoogleDriveAPIError(
      "Failed to upload the video to Google Drive. Please try again.",
      {
        originalMessage: err.message,
      }
    );
  }
};

const getFileMetadata = async (fileId) => {
  const drive = getDriveClient();

  try {
    const res = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, size",
    });

    return res.data;
  } catch (err) {
    throw new GoogleDriveAPIError(
      "Failed to fetch video metadata from Google Drive.",
      {
        originalMessage: err.message,
        fileId,
      }
    );
  }
};

const getFileStream = async (fileId, rangeHeader) => {
  const drive = getDriveClient();

  try {
    const requestOptions = {
      responseType: "stream",
    };

    if (rangeHeader) {
      requestOptions.headers = {
        Range: rangeHeader,
      };
    }

    const res = await drive.files.get(
      {
        fileId,
        alt: "media",
      },
      requestOptions
    );

    return {
      stream: res.data,
      headers: res.headers,
      status: res.status,
    };
  } catch (err) {
    throw new GoogleDriveAPIError(
      "Failed to stream the video from Google Drive.",
      {
        originalMessage: err.message,
        fileId,
      }
    );
  }
};

const deleteFile = async (fileId) => {
  const drive = getDriveClient();

  try {
    await drive.files.delete({
      fileId,
    });
  } catch (err) {
    const status = err.code || err.response?.status;

    if (status === 404) return;

    throw new GoogleDriveAPIError(
      "Failed to delete the video from Google Drive.",
      {
        originalMessage: err.message,
        fileId,
      }
    );
  }
};

module.exports = {
  getDriveClient,
  uploadVideoToDrive,
  getFileMetadata,
  getFileStream,
  deleteFile,
};