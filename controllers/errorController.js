const AppError = require('../utils/appError');

const handleObjectIDDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = Object.keys(err.keyValue)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorsDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);

  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please Login again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Toue token expired. Please Login again!', 401);

const sendErrorDev = (err, req, res) => {
  //A) API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }
  //B) RENDERED WEBSITE
  console.error('Error ', err);

  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message,
  });
};

const sendErrorProd = (err, req, res) => {
  // A) ******API******
  if (req.originalUrl.startsWith('/api')) {
    //a) Operational, trustedd error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }

    //b) Programming or other error: don't leak error details
    // Log the error
    console.error('Error ', err);

    //Send a generic message
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong',
    });
  }

  // B) ******RENDERED WEBSITE**********
  //a) Operational, trustedd error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: err.message,
    });
  }

  //b) Programming or other error: don't leak error details
  // Log the error
  console.error('Error ', err);

  //Send a generic message
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: 'Please try again later',
  });
};

module.exports = (err, req, res, next) => {
  //This is a express error handling middleware which 4 arguments ( err first function )
  //So express automatically gets to know that is is a error handling middleware
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  //Development
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  }
  //Production
  else {
    let error = { ...err };
    error.message = err.message;

    if (error.kind === 'ObjectId') error = handleObjectIDDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error._message === 'Validation failed')
      error = handleValidationErrorsDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};
