const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    default: null
  },
  name: {
    type: String,
    required: [true, 'Please provide your name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot be more than 20 characters']
  },
  subject: {
    type: String,
    required: [true, 'Please provide a subject'],
    trim: true,
    maxlength: [200, 'Subject cannot be more than 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Please provide a message'],
    maxlength: [1000, 'Message cannot be more than 1000 characters']
  },
  status: {
    type: String,
    enum: ['new', 'read', 'replied', 'newlyReplied', 'closed'],
    default: 'new'
  },
  discussion: [{
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for discussion messages']
    },
    name: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
      maxlength: [100, 'Author name cannot be more than 100 characters']
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      required: [true, 'User role is required']
    },
    text: {
      type: String,
      required: [true, 'Message text is required'],
      maxlength: [1000, 'Message cannot be more than 1000 characters']
    },
    date: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['new', 'read'],
      default: 'new'
    }
  }],
  // Soft delete fields - existing documents will have isDeleted: undefined (treated as false)
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      // Transform discussion subdocuments to include id
      if (ret.discussion && Array.isArray(ret.discussion)) {
        ret.discussion = ret.discussion.map(msg => {
          if (msg._id) {
            msg.id = msg._id;
            delete msg._id;
          }
          return msg;
        });
      }
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      // Transform discussion subdocuments to include id
      if (ret.discussion && Array.isArray(ret.discussion)) {
        ret.discussion = ret.discussion.map(msg => {
          if (msg._id) {
            msg.id = msg._id;
            delete msg._id;
          }
          return msg;
        });
      }
      return ret;
    }
  }
});

module.exports = mongoose.model('Contact', ContactSchema);
