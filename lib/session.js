export const sessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'af-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 8,
  },
};
