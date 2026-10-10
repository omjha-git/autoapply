const Profile = require("../models/Profile");

const getProfile = async (req, res) => {
    try {
        let profile = await Profile.findOne({
            clerkId: req.clerkId
        });

        if (!profile) {
            profile = await Profile.create({
                clerkId: req.clerkId
            });
        }

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const profile = await Profile.findOneAndUpdate(
            {
                clerkId: req.clerkId
            },
            req.body,
            {
                new: true,
                upsert: true
            }
        );

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getProfile,
    updateProfile
};