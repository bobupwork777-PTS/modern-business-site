import mongoose from "mongoose";

const PermissionSchema = new mongoose.Schema({

    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    pageId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Page",
        required:true
    },
    access:{
        type:Boolean,
        default:false
    }

});

const Permission =
mongoose.models.Permission ||
mongoose.model("Permission", PermissionSchema);

export default Permission;