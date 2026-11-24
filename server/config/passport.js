import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

const clientID = (process.env.GOOGLE_CLIENT_ID || "").trim();
const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
const callbackURL = (process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback").trim();

if (clientID && clientSecret) {
  console.log("[Passport] Google OAuth Initializing with Client ID ending in:", clientID.slice(-10));

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          const googleId = profile.id;
          const name = profile.displayName || profile.name?.givenName || "Library Member";
          const avatar = profile.photos?.[0]?.value || "";

          if (!email) {
            return done(new Error("No email found from Google account"), null);
          }

          let user = await User.findOne({ googleId });
          if (user) return done(null, user);

          user = await User.findOne({ email });
          if (user) {
            user.googleId = googleId;
            if (!user.avatar && avatar) user.avatar = avatar;
            await user.save();
            return done(null, user);
          }

          user = await User.create({
            name,
            email,
            googleId,
            avatar,
            role: "purchaser",
          });

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
} else {
  console.log("[Passport] Google OAuth skipped: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not provided.");
}

export default passport;