const express = require('express');
const router = express.Router()
const {createChat} = require('../controllers/chat.controller')

const authMiddleware = require('../middlewares/auth.middleware')



router.post('/',authMiddleware.authUser,createChat)




module.exports = router;

