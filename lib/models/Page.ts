import mongoose from "mongoose";


const PageSchema = new mongoose.Schema({

    name:{
        type:String,
        required:true
    },

    path:{
        type:String,
        required:true
    },

    group:{
        type:String,
        required:true
    },

    parentId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Page",
        default:null
    },

    order:{
        type:Number,
        default:0
    },

    active:{
        type:Boolean,
        default:true
    }

});



const Page = mongoose.models.Page || mongoose.model("Page", PageSchema);


export default Page;