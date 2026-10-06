import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
    {
        name: String,
        email: String,
        phone: String,
        dob: String,
        address: String,
        state: String,
        pin: String,
        gender: String,
        role: String,
        active: { type: Boolean, default: true },
        password: String,

        profileImage: {
            type: String,
            default: "",
        },

        resetToken: String,
        resetTokenExpiry: Date,
    },
    { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
