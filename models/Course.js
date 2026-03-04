const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    duration: { type: Number, default: 0 }, // in minutes
    order: { type: Number, required: true },
    isFree: { type: Boolean, default: false },
});

const courseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Course title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
        type: String,
        required: [true, 'Course description is required'],
        maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    shortDescription: {
        type: String,
        maxlength: [200, 'Short description cannot exceed 200 characters'],
        default: '',
    },
    instructor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['Web Development', 'Mobile Development', 'Data Science', 'Machine Learning',
            'Cybersecurity', 'Cloud Computing', 'DevOps', 'UI/UX Design',
            'Digital Marketing', 'Business', 'Photography', 'Music', 'Other'],
    },
    level: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced'],
        default: 'Beginner',
    },
    price: {
        type: Number,
        required: true,
        min: [0, 'Price cannot be negative'],
        default: 0,
    },
    thumbnail: {
        type: String,
        default: '',
    },
    lessons: [lessonSchema],
    tags: [{ type: String, trim: true }],
    requirements: [{ type: String, trim: true }],
    whatYouLearn: [{ type: String, trim: true }],
    isPublished: {
        type: Boolean,
        default: false,
    },
    totalEnrollments: {
        type: Number,
        default: 0,
    },
    rating: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 },
    },
    language: {
        type: String,
        default: 'English',
    },
}, { timestamps: true });

// Virtual: total lessons
courseSchema.virtual('totalLessons').get(function () {
    return this.lessons ? this.lessons.length : 0;
});

courseSchema.virtual('totalDuration').get(function () {
    return this.lessons ? this.lessons.reduce((sum, l) => sum + l.duration, 0) : 0;
});

courseSchema.set('toJSON', { virtuals: true });
courseSchema.set('toObject', { virtuals: true });

// Text search index
courseSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Course', courseSchema);
