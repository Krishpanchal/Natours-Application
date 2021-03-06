const express = require('express');
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');
const viewController = require('../controllers/viewController');

const router = express.Router();

router.use(viewController.alerts);

router.get('/', authController.isLoggedIn, viewController.getOverview);
router.get('/tour/:slug', authController.isLoggedIn, viewController.getTour);

router.get('/login', authController.isLoggedIn, viewController.login);
router.get('/signup', viewController.signup);

router.get('/me', authController.protect, viewController.getAccount);
router.get('/my-tours', authController.protect, viewController.getMyTours);

module.exports = router;
