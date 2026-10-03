const mongoose = require("mongoose");


const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },

    publicId: {
      type: String,
      required: true,
    },
  },
  {
    _id:false
  }
);


const portfolioSchema = new mongoose.Schema(
{
  // Student Owner
  // student:{
  //   type:mongoose.Schema.Types.ObjectId,
  //   ref:"User",
  //   required:true,
  //   index:true
  // },

  // REPLACE the `student` field block:
student:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    default:null,
    index:true
  },

  externalStudent:{
    type:Boolean,
    default:false
  },

  studentName:{
    type:String,
    trim:true,
    default:""
  },

  studentEmail:{
    type:String,
    trim:true,
    default:""
  },

  studentBatch:{
    type:String,
    trim:true,
    default:""
  },

   studentPhoto: imageSchema,

  // NEW: optional short review/testimonial text from the student.
  studentReview: {
    type: String,
    trim: true,
    default: ""
  },


  // Assigned Course Snapshot
  course:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Course",
    required:true
  },


  courseTitle:{
    type:String,
    required:true
  },


  category:{
    type:String,
    required:true,
    enum:[
      "Design",
      "Marketing",
      "3D",
      "Data",
      "Tech"
    ]
  },


  title:{
    type:String,
    required:true,
    trim:true,
    minlength:5,
    maxlength:100
  },


  slug:{
    type:String,
    unique:true,
    index:true
  },


  description:{
    type:String,
    required:true,
    minlength:50
  },


  thumbnail:imageSchema,


  gallery:[
    imageSchema
  ],


  // Different domain links
  githubUrl:{
    type:String,
    default:""
  },


  liveUrl:{
    type:String,
    default:""
  },


  figmaUrl:{
    type:String,
    default:""
  },


  behanceUrl:{
    type:String,
    default:""
  },


  videoUrl:{
    type:String,
    default:""
  },


  driveUrl:{
    type:String,
    default:""
  },


  technologies:[
    {
      type:String
    }
  ],


  tags:[
    {
      type:String
    }
  ],


 status:{
  type:String,
  enum:[
    "draft",
    "pending",
    "approved",
    "rejected",
    "published",
    "archived"
  ],
  default:"draft"
},


  featured:{
    type:Boolean,
    default:false
  },


  adminRemarks:{
    type:String,
    default:""
  },


  approvedBy:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    default:null
  },


  approvedAt:{
    type:Date,
    default:null
  },


  publishedAt:{
    type:Date,
    default:null
  },


  views:{
    type:Number,
    default:0
  },


  likes:{
    type:Number,
    default:0
  }


},
{
 timestamps:true
}
);

// ADD right before `module.exports = mongoose.model(...)`:
portfolioSchema.pre("validate", async function () {
  if (!this.externalStudent && !this.student) {
    throw new Error("student is required for non-external portfolios");
  }

  if (this.externalStudent && (!this.studentName || !this.studentName.trim())) {
    throw new Error("studentName is required for external portfolios");
  }
});

module.exports = mongoose.model(
 "Portfolio",
 portfolioSchema
);