const multer = require("multer");

const storage = multer.memoryStorage();


const fileFilter = (req, file, cb) => {

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];


  if (!allowed.includes(file.mimetype)) {

    return cb(
      new Error("Only JPG, PNG, WEBP images and PDF files are allowed."),
      false
    );

  }


  cb(null, true);

};



const upload = multer({

  storage,

  fileFilter,

  limits:{
    fileSize:20 * 1024 * 1024, // 20MB
  }

});



const placementUpload = upload.fields([
  {
    name:"image",
    maxCount:1,
  },
  {
    name:"offerLetter",
    maxCount:1,
  }
]);



module.exports = placementUpload;