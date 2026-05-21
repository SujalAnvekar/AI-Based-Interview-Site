import mongoose from "mongoose";

const connectDb=async()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("MongoDb connected..")
    } catch (error) {
        console.log(`Db error ${error}`)
    }
}

export default connectDb