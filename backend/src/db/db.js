const mongoose = require('mongoose');

async function connectToDB(){
    try{
        await mongoose.connect(process.env.MONGODB_URL)
        console.log('Connected to DB')
    }catch(err){
        console.log("Error connecting to DB", err)
    }
}

module.exports = connectToDB;