const { getAuth } = require("@clerk/express");

const requireAuth = (
    req,
    res,
    next
) => {

    const auth =
        getAuth(req);

    console.log(
        "AUTH USER:",
        auth.userId
    );

    if (!auth.userId) {
        return res.status(401).json({
            success: false,
            message:
                "Authentication required"
        });
    }

    req.clerkId =
        auth.userId;

    next();
};

module.exports =
    requireAuth;