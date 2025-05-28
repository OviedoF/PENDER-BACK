import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  type: { type: String, enum: ["adoption", "findMe"], default: "findMe" },
  findMe: { type: mongoose.Schema.Types.ObjectId, ref: "FindMe" },
  adoption: { type: mongoose.Schema.Types.ObjectId, ref: "Adoption" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: {
    type: String,
    enum: ["active", "rejected"],
    default: "active",
  },
});

export default mongoose.model("Chat", chatSchema);