const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";

const IV_LENGTH = 16;

// Render/local dono ke liye safe key handling
const SECRET_KEY =
  process.env.IP_ENCRYPTION_KEY || "default-ip-encryption-secret-key-change-this";

const KEY = crypto
  .createHash("sha256")
  .update(String(SECRET_KEY))
  .digest();


// Encrypt
const encrypt = (text) => {
  if (!text) return null;

  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    KEY,
    iv
  );

  let encrypted = cipher.update(
    String(text),
    "utf8",
    "hex"
  );

  encrypted += cipher.final("hex");

  return `${iv.toString("hex")}:${encrypted}`;
};


// Decrypt
const decrypt = (encryptedText) => {
  if (!encryptedText) return null;

  try {
    const [iv, encrypted] = encryptedText.split(":");

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      KEY,
      Buffer.from(iv, "hex")
    );

    let decrypted = decipher.update(
      encrypted,
      "hex",
      "utf8"
    );

    decrypted += decipher.final("utf8");

    return decrypted;

  } catch (error) {
    console.error("Decrypt error:", error.message);
    return null;
  }
};


module.exports = {
  encrypt,
  decrypt,
};