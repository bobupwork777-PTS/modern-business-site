import { Schema, models, model } from "mongoose";

const CountrySchema = new Schema({
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true },
    active: { type: Boolean, default: true }
}, { timestamps: true, collection: "countries" });

CountrySchema.index({ normalizedName: 1 }, { unique: true });

export default models.Country || model("Country", CountrySchema);