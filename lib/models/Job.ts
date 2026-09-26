import { Schema, models, model } from "mongoose";

const JobSchema = new Schema({
    title: String,
    description: String,
    budget: String,
    score: Number,
    matchedSkills: { type: [String], default: [] },
    aiReport: Object
}, { timestamps: true });

export default models.Job || model("Job", JobSchema);