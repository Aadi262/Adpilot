'use strict';

const express = require('express');
const { register, login, validateRegister, validateLogin, forgotPassword, resetPassword } = require('../controllers/authController');
const { demoLogin } = require('../controllers/demoController');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/register',        authLimiter, validateRegister, register);
router.post('/login',           authLimiter, validateLogin,    login);
router.post('/forgot-password', authLimiter,                   forgotPassword);
router.post('/reset-password',  authLimiter,                   resetPassword);
router.post('/demo-login',                                     demoLogin); // public — no auth middleware

module.exports = router;
