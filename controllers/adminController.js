const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');

// @desc    Get platform stats
// @route   GET /api/admin/stats
// @access  Admin
const getStats = async (req, res, next) => {
    try {
        const [totalUsers, totalCourses, totalEnrollments, instructors, students] = await Promise.all([
            User.countDocuments(),
            Course.countDocuments(),
            Enrollment.countDocuments(),
            User.countDocuments({ role: 'instructor' }),
            User.countDocuments({ role: 'student' }),
        ]);

        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt avatar');
        const popularCourses = await Course.find({ isPublished: true })
            .sort({ totalEnrollments: -1 })
            .limit(5)
            .select('title totalEnrollments rating category')
            .populate('instructor', 'name');

        res.json({
            success: true,
            stats: { totalUsers, totalCourses, totalEnrollments, instructors, students, admins: totalUsers - instructors - students },
            recentUsers,
            popularCourses,
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Admin
const getUsers = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, role, search } = req.query;
        const query = {};
        if (role) query.role = role;
        if (search) query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('-password -refreshToken');

        res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), users });
    } catch (err) {
        next(err);
    }
};

// @desc    Update user role or status
// @route   PATCH /api/admin/users/:id
// @access  Admin
const updateUser = async (req, res, next) => {
    try {
        const { role, isActive } = req.body;

        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot modify your own account role.' });
        }

        const updateFields = {};
        if (role) updateFields.role = role;
        if (typeof isActive === 'boolean') updateFields.isActive = isActive;

        const user = await User.findByIdAndUpdate(req.params.id, updateFields, { new: true }).select('-password -refreshToken');
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        res.json({ success: true, message: 'User updated.', user });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUser = async (req, res, next) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
        }

        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        // Cleanup user data
        await Enrollment.deleteMany({ student: req.params.id });
        await Course.deleteMany({ instructor: req.params.id });

        res.json({ success: true, message: 'User deleted.' });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all courses (admin view)
// @route   GET /api/admin/courses
// @access  Admin
const getAllCourses = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Course.countDocuments();
        const courses = await Course.find()
            .populate('instructor', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('title category isPublished totalEnrollments rating createdAt price level');

        res.json({ success: true, total, courses });
    } catch (err) {
        next(err);
    }
};

module.exports = { getStats, getUsers, updateUser, deleteUser, getAllCourses };
