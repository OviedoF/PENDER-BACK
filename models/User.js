import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  birthdate: { type: Date, default: null },
  phone: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, enum: ["user", "moderator", "admin", "enterprise", "aprobation"], default: "user" },
  suscription: { type: String, enum: ["free", 'basic', "pro"], default: "free" },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  image: { type: String },

  // ENTERPRISE USER
  ruc: { type: String },
  socialReason: { type: String },
  commercialName: { type: String },
  city: { type: String },
  district: { type: String },
  department: { type: String },

  principalActivity: { type: String },
  secondaryActivity: { type: String },
  description: { type: String },
  potentialSegment: { type: String },
  images: { type: Array },
  preferences: { type: Array },
  saveHistory: { type: Boolean, default: false },
  balance: { type: Number, default: 0 },

  banks: [{
    name: { type: String, required: true },
    type: { type: String, required: true },
    number: { type: String, required: true },
  }],

  // NOTIFICATIONS
  loginNotifications: { type: Boolean, default: false },
}, {
  timestamps: true,
})

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model("User", userSchema);
