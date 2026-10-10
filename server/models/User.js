const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        clerkId: {
            type: String,
            required: true,
            unique: true
        },

        email: {
            type: String,
            required: true
        },

        name: {
            type: String,
            default: ""
        },

        image: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);