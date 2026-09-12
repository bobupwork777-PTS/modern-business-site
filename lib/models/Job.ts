import mongoose from "mongoose";


const JobSchema = new mongoose.Schema({

    title:String,

    description:String,

    budget:String,

    score:Number,

    matchedSkills:{
        type:[String],
        default:[]
    },

    aiReport:Object

},{
    timestamps:true
});


export default mongoose.models.Job ||
mongoose.model("Job",JobSchema);