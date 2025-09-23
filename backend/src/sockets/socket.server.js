const { Server } = require("socket.io");
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model')
const aiService = require('../services/ai.service')
const messageModel = require('../models/message.model')
const {createMemory, queryMemory} = require('../services/vectors.service')

function initSocketServer(httpServer) {
    const io = new Server(httpServer, {});

    // socket middleware
    io.use(async (socket, next) => {
        const cookies = cookie.parse(socket.handshake.headers?.cookie || "")
        if (!cookies.token) {
            next(new Error("Authentication Error: No token provided"))
        }
        try {
            const decoded = jwt.verify(cookies.token, process.env.JWT_SECRET)
            const user = await userModel.findById(decoded.id);
            socket.user = user
            next()
        } catch (err) {
            next(new Error("Authentication Error: Invalid token"))
        }
    })

    io.on("connection", (socket) => {


        socket.on("ai-message", async (messagePayload) => {
            // console.log(messagePayload)
            // console.lo g(socket.user)

            const message = await messageModel.create({
                chat: messagePayload.chat,
                user: socket.user._id,
                content: messagePayload.content,
                role: "user"
            })

            const vectors = await aiService.generateVector(messagePayload.content)
            const memory = await queryMemory({
                queryVector:vectors,
                limit:3,
                metadata:{}
            })

            await createMemory({
                vectors,
                messageId:message._id,
                metadata:{
                    chat:messagePayload.chat,
                    text:messagePayload.content,
                    user:socket.user._id
                }
            })
            console.log(memory)


            

            const rawChatHistory = (await messageModel.find({
                chat: messagePayload.chat
            }).sort({createdAt:-1}).limit(20).lean()).reverse()


            const chatHistory = rawChatHistory.map(item => {
                return {
                role: item.role,
                parts: [{ text: item.content }]
            }
            });

            // console.log(formattedHistory);

            const response = await aiService.generateResponse(chatHistory)


           const responseMessage = await messageModel.create({
                chat: messagePayload.chat,
                user: socket.user._id,
                content: response,
                role: "model"
            })
            const responseVectors = await aiService.generateVector(response)
            await createMemory({
                vectors : responseVectors,
                messageId:responseMessage._id,
                metadata:{
                    chat:messagePayload.chat,
                    text:response,
                    user:socket.user._id
                }
            })

            socket.emit("ai-response", {
                content: response,
                chat: messagePayload.chat
            })

        })

    })
}


module.exports = initSocketServer;