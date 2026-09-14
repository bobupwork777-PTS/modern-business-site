import mongoose, { Schema } from "mongoose";

const QueuedJobSchema = new Schema(
  {
    userId: {
      type: String,
      default: "global",
      index: true
    },

    jobId: {
      type: String,
      required: true
    },

    title: {
      type: String,
      default: ""
    },

    description: {
      type: String,
      default: ""
    },

    url: {
      type: String,
      default: ""
    },

    country: {
      type: String,
      default: ""
    },

    budget: {
      type: String,
      default: ""
    },

    publishedDateTime: {
      type: String,
      default: ""
    },

    applied: {
      type: Boolean,
      default: false
    },

    isFeatured: {
      type: Boolean,
      default: false
    },

    isPreviousClient: {
      type: Boolean,
      default: false
    },

    rawJob: {
      type: Schema.Types.Mixed,
      required: true
    }
  },
  {
    timestamps: true,
    collection: "job_queue"
  }
);

QueuedJobSchema.index(
  {
    userId: 1,
    jobId: 1
  },
  {
    unique: true
  }
);

export default mongoose.models.QueuedJob ||
  mongoose.model("QueuedJob", QueuedJobSchema);