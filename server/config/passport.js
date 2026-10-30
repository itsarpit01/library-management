import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback",
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

        // 1. Agar user googleId se pehle se exist karta hai -> return user
        let user = await User.findOne({ googleId });
        if (user) {
          return done(null, user);
        }

        // 2. Agar user email se pehle registered tha -> link googleId & avatar
        user = await User.findOne({ email });
        if (user) {
          user.googleId = googleId;
          if (!user.avatar && avatar) {
            user.avatar = avatar;
          }
          await user.save();
          return done(null, user);
        }

        // 3. Agar bilkul naya user hai -> create account with purchaser role
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

export default passport;