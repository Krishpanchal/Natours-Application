/* eslint-disable arrow-body-style */
const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

//returns the token
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);

  const cookieOption = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: req.secure || req.headers('x-forwarded-proto') === 'https',
  };

  //This might not run
  if (process.env.NODE_ENV === 'production') cookieOption.secure = true;

  res.cookie('jwt', token, cookieOption);

  //Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res) => {
  // const newUser = await User.create(req.body);

  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  const url = `${req.protocol}://${req.get('host')}/me`;

  await new Email(newUser, url).sendWelcome();

  //Create a jwt token
  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1) Check if email and password exists
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  //2) Check if the email exists and password is correct
  const user = await User.findOne({ email }).select('+password');

  //checks if user exists and if password is correct or not
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  //3) if everything ok, send the token to client
  createSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'null', {
    expires: new Date(Date.now() - 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ status: 'success' });
};

//Middlwares
exports.protect = catchAsync(async (req, res, next) => {
  //1) Get the token and check if it exists
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in. Please login to get access!', 401)
    );
  }

  // 2)Verify the token

  //The promisify() function will return a version Promise of your function
  //as jwt.verfity uses callback only, we make jwt.verfiy return a promise
  //Similar to
  //const verify = promisify(jwt.verify);
  //verify(token, process.env.JWT_SECRET).then().catch()

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  //3). Check if the user still exits
  const currentUser = await User.findById(decoded.id);
  if (!currentUser)
    return next(
      new AppError('The user belonging to the token does not exist', 401)
    );

  //4. Check if user changed password after the token was issued
  if (currentUser.changedPassword(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please login again', 401)
    );
  }

  //Grant access to protected route
  req.user = currentUser;
  res.locals.user = currentUser;

  next();
});

//Only for rendered pages
exports.isLoggedIn = catchAsync(async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1. Verify the token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      //2). Check if the user still exits
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) return next();

      //4. Check if user changed password after the token was issued
      if (currentUser.changedPassword(decoded.iat)) {
        return next();
      }

      //There is a logged in user
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }

  next();
});

exports.restrictTo = (...roles) => {
  //roles ==> ['admin', 'lead-guide']

  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  //Get the posted email
  if (!req.body.email) {
    return next(new AppError('Please provide your email', 400));
  }

  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError('The user with the email does not exist', 404));
  }

  //Generate the random reset token
  const resetToken = user.createPasswordResetToken();

  //Save the passwordToekns fields in the database
  await user.save({ validateBeforeSave: false });

  //Send it to the user's email
  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;

    await new Email(user, resetURL).sendResetPassword();

    res.status(200).json({
      satus: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError('There was an error sending the email. Try again later', 500)
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  //1)Get the user from the token passed
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  //2)If the token not is not expired and there is a user, set the new password
  if (!user) {
    next(new AppError('Token is invalid or expired'));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  //3)Update the changePasswordAt property for the user
  //4)Login the user in, send JWT
  createSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //Get the user from the collection
  const user = await User.findById(req.user._id).select('+password');

  //Check if the posted password if correct
  const { currentPassword, newPassword, passwordConfirm } = req.body;

  if (!currentPassword || !newPassword || !passwordConfirm) {
    return next(new AppError('Please provide all the fields', 401));
  }

  if (!(await user.correctPassword(currentPassword, user.password))) {
    return next(new AppError('Please provide correct current password', 401));
  }

  //if so, update the password
  user.password = newPassword;
  user.passwordConfirm = passwordConfirm;
  await user.save();
  //User.findByIdAndUpdate will not work here

  //Login the user, send jwt
  createSendToken(user, 200, req, res);
});
