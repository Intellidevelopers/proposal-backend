import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  plan: "Free" | "Pro";
  role: "user" | "admin";
  country: string;
  cohereApiKey: string;
  proposalsThisMonth: number;
  resetProposalsAt: Date;
  comparePassword(c: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name:               { type: String, required: true },
    email:              { type: String, required: true, unique: true, lowercase: true },
    password:           { type: String, required: true, minlength: 6, select: false },
    plan:               { type: String, enum: ["Free", "Pro"], default: "Free" },
    role:               { type: String, enum: ["user", "admin"], default: "user" },
    country:            { type: String, default: "" },
    cohereApiKey:       { type: String, default: "", select: false },
    proposalsThisMonth: { type: Number, default: 0 },
    resetProposalsAt:   { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret["password"];
        delete ret["cohereApiKey"];
        return ret;
      },
    },
  }
);

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

UserSchema.methods.comparePassword = function (c: string): Promise<boolean> {
  return bcrypt.compare(c, this.password);
};

export default mongoose.model<IUser>("User", UserSchema);