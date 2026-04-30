const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    // Relationship: every message belongs to one user (the sender).
  },
  roomId: {
    type: String,
    required: true,
    trim: true,
    // Messages with the same roomId belong to the same chat room.
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    // Stores when this message was created/sent.
  },
});

module.exports = mongoose.model("Message", messageSchema);
