const { Server } = require("socket.io");

function initSocketServer(httpServer){
    const io = new Server(httpServer,{});


    io.on("connection",()=>{
        console.log("New socket connection :", socket.id)
    })
}


module.exports = initSocketServer;