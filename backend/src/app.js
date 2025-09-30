const express = require('express')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const app = express()

// Routes
const authRoutes = require('./routes/auth.routes')
const chatRoutes = require('./routes/chat.route')

//Using Middlewares
app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin:'http://localhost:5173',
    credentials:true
}))

//Using Routes
app.use('/api/auth',authRoutes)
app.use('/api/chat',chatRoutes)



module.exports = app; 