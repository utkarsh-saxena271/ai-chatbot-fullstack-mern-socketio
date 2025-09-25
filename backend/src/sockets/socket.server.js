const { Server } = require("socket.io");
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model')
const aiService = require('../services/ai.service')
const messageModel = require('../models/message.model')
const { createMemory, queryMemory } = require('../services/vectors.service')

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
            /*
            save message from user to mongodb
            const message = await messageModel.create({
                chat: messagePayload.chat,
                user: socket.user._id,
                content: messagePayload.content,
                role: "user"
            })
            create its vectors
            const vectors = await aiService.generateVector(messagePayload.content)
            */
            // optimised
            const [message, vectors] = await Promise.all([
                messageModel.create({
                    chat: messagePayload.chat,
                    user: socket.user._id,
                    content: messagePayload.content,
                    role: "user"
                }),
                aiService.generateVector(messagePayload.content),
            ])
            // create memory(save usermessage to pinecone)
               await createMemory({
                    vectors,
                    messageId: message._id,
                    metadata: {
                        chat: messagePayload.chat,
                        text: messagePayload.content,
                        user: socket.user._id
                    }
                })

            /*
            // query pinecone for related memory
            const memory = await queryMemory({
                queryVector: vectors,
                limit: 3,
                metadata: {
                    user: socket.user._id
                }
            })

            //retrieve chathistory from mongodb for stm
            const chatHistory = (await messageModel.find({
                chat: messagePayload.chat
            }).sort({ createdAt: -1 }).limit(20).lean()).reverse()
            */
            // optimised approach
            const [memory, chatHistory] = await Promise.all([
                queryMemory({
                    queryVector: vectors,
                    limit: 3,
                    metadata: {
                        user: socket.user._id
                    }
                }),
                messageModel.find({
                    chat: messagePayload.chat
                }).sort({ createdAt: -1 }).limit(20).lean().then(messages => messages.reverse())

            ])

            // create short term memory
            const stm = chatHistory.map(item => {
                return {
                    role: item.role,
                    parts: [{ text: item.content }]
                }
            });

            // create long term memory
            const ltm = [
                {
                    role: 'user',
                    parts: [{
                        text: `

                        these are some previous messages from the chat,use them to generate a response
                        ${memory.map(item => item.metadata.text).join('\n')}

                        `}]
                }
            ]

            // send ltm and stm to ai and get ai-response
            const response = await aiService.generateResponse([...ltm, ...stm])

           // send ai-reponse to user
            socket.emit("ai-response", {
                content: response,
                chat: messagePayload.chat
            })




            /* 
            // save ai-respone to mongodb
            const responseMessage = await messageModel.create({
                chat: messagePayload.chat,
                user: socket.user._id,
                content: response,
                role: "model"
            })

            // create ai-response vector
            const responseVectors = await aiService.generateVector(response)
            */
            //    optimised 
            const [responseMessage, responseVectors] = await Promise.all([
                messageModel.create({
                    chat: messagePayload.chat,
                    user: socket.user._id,
                    content: response,
                    role: "model"
                }),
                aiService.generateVector(response)
            ])
             //  create memory for ai-response in pinecone
            await createMemory({
                vectors: responseVectors,
                messageId: responseMessage._id,
                metadata: {
                    chat: messagePayload.chat,
                    text: response,
                    user: socket.user._id
                }
            })

            
        })

    })
}


module.exports = initSocketServer;