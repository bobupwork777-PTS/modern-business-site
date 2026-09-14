import mongoose, { Schema } from "mongoose";

const SkillSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    collection: "skills"
  }
);

SkillSchema.index(
  { normalizedName: 1 },
  { unique: true }
);

export default mongoose.models.Skill ||
  mongoose.model("Skill", SkillSchema);