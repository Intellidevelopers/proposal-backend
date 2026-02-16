import mongoose, { Schema } from "mongoose";

const ProposalSchema = new Schema({
  user:          { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  jobTitle:      { type: String, required: true },
  jobDescription:{ type: String, required: true },
  generatedText: { type: String, required: true },
  score:         { type: Number, default: 0 },
  tone:          { type: String, default: "Confident" },
  length:        { type: String, default: "Medium" },
  skills:        [String],
  experience:    { type: String, default: "mid" },
  budget:        String,
  timeline:      String,
}, { timestamps: true });

export default mongoose.model("Proposal", ProposalSchema);