const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  // Generate token
  const token = typeof user.getSignedJwtToken === 'function'
    ? user.getSignedJwtToken()
    : generateJwtToken(user.id || user._id);

  const options = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  // Convert Mongoose document to JSON to apply toJSON transform
  const userJSON = user.toJSON ? user.toJSON() : user;

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      message,
      user: userJSON,
    });
};

const generateJwtToken = (userId) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

const clearTokenCookie = (res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
};

module.exports = {
  sendTokenResponse,
  clearTokenCookie,
  generateJwtToken,
};