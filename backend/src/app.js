const express = require('express')
const cookieParser = require('cookie-parser')

const app = express()

// Routes
const authRoutes = require('./routes/auth.routes')
const chatRoutes = require('./routes/chat.route')

//Using Middlewares
app.use(express.json())
app.use(cookieParser())

//Using Routes
app.use('/api/auth',authRoutes)
app.use('/api/chat',chatRoutes)



module.exports = app; 