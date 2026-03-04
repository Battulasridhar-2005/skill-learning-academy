const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');

// @desc    Enroll in a course
// @route   POST /api/enrollments/:courseId
// @access  Student
const enrollCourse = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.courseId);
        if (!course || !course.isPublished) {
            return res.status(404).json({ success: false, message: 'Course not found or not published.' });
        }

        // Instructors can't enroll in their own course
        if (course.instructor.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot enroll in your own course.' });
        }

        const existing = await Enrollment.findOne({ student: req.user._id, course: course._id });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Already enrolled in this course.' });
        }

        const enrollment = await Enrollment.create({
            student: req.user._id,
            course: course._id,
            paymentStatus: course.price === 0 ? 'free' : 'paid',
        });

        // Increment enrollment count
        await Course.findByIdAndUpdate(course._id, { $inc: { totalEnrollments: 1 } });

        res.status(201).json({ success: true, message: 'Enrolled successfully!', enrollment });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Already enrolled in this course.' });
        }
        next(err);
    }
};

// @desc    Get student's enrolled courses
// @route   GET /api/enrollments/my-courses
// @access  Student
const getMyEnrollments = async (req, res, next) => {
    try {
        const enrollments = await Enrollment.find({ student: req.user._id })
            .populate({
                path: 'course',
                select: 'title thumbnail category level instructor totalLessons rating price',
                populate: { path: 'instructor', select: 'name avatar' },
            })
            .sort({ createdAt: -1 });

        res.json({ success: true, enrollments });
    } catch (err) {
        next(err);
    }
};

// @desc    Update lesson progress
// @route   PATCH /api/enrollments/:courseId/progress
// @access  Student
const updateProgress = async (req, res, next) => {
    try {
        const { lessonId, completed } = req.body;

        const enrollment = await Enrollment.findOne({ student: req.user._id, course: req.params.courseId });
        if (!enrollment) {
            return res.status(404).json({ success: false, message: 'Not enrolled in this course.' });
        }

        const course = await Course.findById(req.params.courseId).select('lessons');
        if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

        if (completed && !enrollment.completedLessons.includes(lessonId)) {
            enrollment.completedLessons.push(lessonId);
        } else if (!completed) {
            enrollment.completedLessons = enrollment.completedLessons.filter(id => id.toString() !== lessonId);
        }

        const progress = course.lessons.length > 0
            ? Math.round((enrollment.completedLessons.length / course.lessons.length) * 100)
            : 0;
        enrollment.progress = progress;

        if (progress === 100) {
            enrollment.completedAt = new Date();
        }

        await enrollment.save();
        res.json({ success: true, enrollment });
    } catch (err) {
        next(err);
    }
};

// @desc    Rate a course
// @route   POST /api/enrollments/:courseId/rate
// @access  Student (enrolled)
const rateCourse = async (req, res, next) => {
    try {
        const { rating, review } = req.body;

        const enrollment = await Enrollment.findOne({ student: req.user._id, course: req.params.courseId });
        if (!enrollment) {
            return res.status(404).json({ success: false, message: 'Not enrolled in this course.' });
        }

        enrollment.rating = { value: rating, review, ratedAt: new Date() };
        await enrollment.save();

        // Recalculate course rating
        const allRatings = await Enrollment.find({ course: req.params.courseId, 'rating.value': { $ne: null } });
        const avg = allRatings.reduce((sum, e) => sum + e.rating.value, 0) / allRatings.length;
        await Course.findByIdAndUpdate(req.params.courseId, {
            'rating.average': Math.round(avg * 10) / 10,
            'rating.count': allRatings.length,
        });

        res.json({ success: true, message: 'Rating submitted.' });
    } catch (err) {
        next(err);
    }
};

module.exports = { enrollCourse, getMyEnrollments, updateProgress, rateCourse };
