import mongoose, { Schema, Model } from "mongoose";


const SavedFilterSchema = new Schema(

{
    userId:{
        type:String,
        required:true
    },

    name:{
        type:String,
        required:true
    },

    countries:{
        type:[String],
        default:[]
    },

    skills:{
        type:[String],
        default:[]
    },


    budgetMin:{
        type:String,
        default:""
    },


    budgetMax:{
        type:String,
        default:""
    },


    paymentVerified:{
        type:String,
        default:"all"
    },


    applicantRange:{
        type:String,
        default:"all"
    },


    postedDays:{
        type:String,
        default:"all"
    },


    search:{
        type:String,
        default:""
    },


},
{
    timestamps:true
}

);


const SavedFilter: Model<any> =
    mongoose.models.SavedFilter ||
    mongoose.model(
        "SavedFilter",
        SavedFilterSchema
    );


export default SavedFilter;