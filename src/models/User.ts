import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export const FREE_MONTHLY_CAP = 3; // ← changed from 10 to 3

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
  isPro(): boolean;
  canGenerate(): boolean;
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

// Pro users have unlimited proposals
UserSchema.methods.isPro = function (): boolean {
  return this.plan === "Pro";
};

// Returns true if user is allowed to generate another proposal
UserSchema.methods.canGenerate = function (): boolean {
  if (this.isPro()) return true;
  return this.proposalsThisMonth < FREE_MONTHLY_CAP;
};

export default mongoose.model<IUser>("User", UserSchema);