import { Schema, models, model } from "mongoose";

const PromptSchema = new Schema({
    skillId: { type: String, required: true },
    skillName: { type: String, required: true },
    prompt: { type: String, required: true },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, 
{ collection: "prompts" });

export default models.Prompt || model("Prompt", PromptSchema);