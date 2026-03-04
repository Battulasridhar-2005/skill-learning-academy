const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },
    completedLessons: [{
        type: mongoose.Schema.Types.ObjectId,
    }],
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    completedAt: {
        type: Date,
        default: null,
    },
    rating: {
        value: { type: Number, min: 1, max: 5, default: null },
        review: { type: String, maxlength: 500, default: '' },
        ratedAt: { type: Date, default: null },
    },
    paymentStatus: {
        type: String,
        enum: ['free', 'paid', 'pending'],
        default: 'free',
    },
}, { timestamps: true });

// A student can only enroll once per course
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
