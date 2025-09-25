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

            // save message from user to db
            const message = await messageModel.create({
                chat: messagePayload.chat,
                user: socket.user._id,
                content: messagePayload.content,
                role: "user"
            })
            // create its vectors
            const vectors = await aiService.generateVector(messagePayload.content)


            // query memory
            const memory = await queryMemory({
                queryVector:vectors,
                limit:3,
                metadata:{
                    user:socket.user._id
                }
            })

            // create memory
            await createMemory({
                vectors,
                messageId:message._id,
                metadata:{
                    chat:messagePayload.chat,
                    text:messagePayload.content,
                    user:socket.user._id
                }
            })
            


            
            // create chathistory for stm
            const chatHistory = (await messageModel.find({
                chat: messagePayload.chat
            }).sort({createdAt:-1}).limit(20).lean()).reverse()


            const stm = chatHistory.map(item => {
                return {
                role: item.role,
                parts: [{ text: item.content }]
            }
            });

            const ltm = [
                {
                    role:'user',
                    parts:[ {text:`

                        these are some previous messages from the chat,use them to generate a response
                        ${memory.map(item => item.metadata.text).join('\n')}

                        `} ]
                }
            ]

           console.log(ltm[0])
           console.log(stm)

            // send chathistory to ai and get response
            const response = await aiService.generateResponse([...ltm,...stm])

            // save respone to db
           const responseMessage = await messageModel.create({
                chat: messagePayload.chat,
                user: socket.user._id,
                content: response,
                role: "model"
            })

            // create response vector
            const responseVectors = await aiService.generateVector(response)

            // again create memory
            await createMemory({
                vectors : responseVectors,
                messageId:responseMessage._id,
                metadata:{
                    chat:messagePayload.chat,
                    text:response,
                    user:socket.user._id
                }
            })


            // send reponse to user
            socket.emit("ai-response", {
                content: response,
                chat: messagePayload.chat
            })

        })

    })
}


module.exports = initSocketServer;