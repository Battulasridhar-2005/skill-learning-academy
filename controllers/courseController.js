const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { validationResult } = require('express-validator');

// @desc    Get all published courses (with search/filter)
// @route   GET /api/courses
// @access  Public
const getCourses = async (req, res, next) => {
    try {
        const { search, category, level, page = 1, limit = 12, sortBy = 'createdAt' } = req.query;

        const query = { isPublished: true };

        if (search) {
            query.$text = { $search: search };
        }
        if (category) query.category = category;
        if (level) query.level = level;

        const sortOptions = {
            createdAt: { createdAt: -1 },
            popular: { totalEnrollments: -1 },
            rating: { 'rating.average': -1 },
            price_asc: { price: 1 },
            price_desc: { price: -1 },
        };

        const sort = sortOptions[sortBy] || { createdAt: -1 };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Course.countDocuments(query);
        const courses = await Course.find(query)
            .populate('instructor', 'name avatar bio')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .select('-lessons.videoUrl');

        res.json({
            success: true,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            courses,
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Public
const getCourse = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id)
            .populate('instructor', 'name avatar bio email');

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found.' });
        }

        // Check if requester is enrolled (to show video URLs)
        let isEnrolled = false;
        if (req.user) {
            const enrollment = await Enrollment.findOne({ student: req.user._id, course: course._id });
            isEnrolled = !!enrollment;
        }

        const courseData = course.toJSON();
        if (!isEnrolled) {
            // Hide video URLs for non-enrolled, non-instructors
            const isOwner = req.user && (req.user._id.toString() === course.instructor._id.toString() || req.user.role === 'admin');
            if (!isOwner) {
                courseData.lessons = courseData.lessons.map(l => ({
                    ...l,
                    videoUrl: l.isFree ? l.videoUrl : '',
                }));
            }
        }

        res.json({ success: true, course: courseData, isEnrolled });
    } catch (err) {
        next(err);
    }
};

// @desc    Create course
// @route   POST /api/courses
// @access  Instructor / Admin
const createCourse = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: errors.array()[0].msg });
        }

        const course = await Course.create({ ...req.body, instructor: req.user._id });
        await course.populate('instructor', 'name avatar');

        res.status(201).json({ success: true, message: 'Course created.', course });
    } catch (err) {
        next(err);
    }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Instructor (owner) / Admin
const updateCourse = async (req, res, next) => {
    try {
        let course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

        if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to update this course.' });
        }

        const { instructor, totalEnrollments, rating, ...updateData } = req.body;
        course = await Course.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
            .populate('instructor', 'name avatar');

        res.json({ success: true, message: 'Course updated.', course });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Instructor (owner) / Admin
const deleteCourse = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

        if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this course.' });
        }

        await Course.findByIdAndDelete(req.params.id);
        await Enrollment.deleteMany({ course: req.params.id });

        res.json({ success: true, message: 'Course deleted.' });
    } catch (err) {
        next(err);
    }
};

// @desc    Get instructor's own courses
// @route   GET /api/courses/my-courses
// @access  Instructor
const getInstructorCourses = async (req, res, next) => {
    try {
        const courses = await Course.find({ instructor: req.user._id })
            .select('title thumbnail isPublished totalEnrollments createdAt category level price rating')
            .sort({ createdAt: -1 });
        res.json({ success: true, courses });
    } catch (err) {
        next(err);
    }
};

module.exports = { getCourses, getCourse, createCourse, updateCourse, deleteCourse, getInstructorCourses };
