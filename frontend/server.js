const express = require('express');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { userInfo } = require('os');

const app = express();
const PORT = 3000;

// =======================
// CONFIG
// =======================

// Grades still via REST
const GRADES_SERVICE_URL = process.env.GRADES_URL || 'http://localhost:7000';

// ----- Auth gRPC -----
const AUTH_PROTO_PATH = path.join(__dirname, 'proto', 'auth.proto');
const AUTH_GRPC_ADDR = process.env.AUTH_GRPC_ADDR || 'auth-service:4000';

const authPackageDef = protoLoader.loadSync(AUTH_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const authProto = grpc.loadPackageDefinition(authPackageDef).auth;
const authClient = new authProto.AuthService(
  AUTH_GRPC_ADDR,
  grpc.credentials.createInsecure()
);

// ----- Course gRPC -----
const COURSE_PROTO_PATH = path.join(__dirname, 'proto', 'course.proto');
const COURSE_GRPC_ADDR = process.env.COURSE_GRPC_ADDR || 'course-service:5000';

const coursePackageDef = protoLoader.loadSync(COURSE_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const courseProto = grpc.loadPackageDefinition(coursePackageDef).course;
const courseClient = new courseProto.CourseService(
  COURSE_GRPC_ADDR,
  grpc.credentials.createInsecure()
);

// ----- Enrollment gRPC -----
const ENROLLMENT_PROTO_PATH = path.join(__dirname, 'proto', 'enrollment.proto');
const ENROLLMENT_GRPC_ADDR =
  process.env.ENROLL_GRPC_ADDR || 'enrollment-service:6000';

const enrollmentPackageDef = protoLoader.loadSync(ENROLLMENT_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const enrollmentProto = grpc.loadPackageDefinition(enrollmentPackageDef)
  .enrollment;
const enrollmentClient = new enrollmentProto.EnrollmentService(
  ENROLLMENT_GRPC_ADDR,
  grpc.credentials.createInsecure()
);

// ----- Grades gRPC -----
const GRADES_PROTO_PATH = path.join(__dirname, 'proto', 'grades.proto');
const GRADES_GRPC_ADDR = process.env.GRADES_GRPC_ADDR || 'grades-service:7000';

const gradesPackageDef = protoLoader.loadSync(GRADES_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const gradesProto = grpc.loadPackageDefinition(gradesPackageDef).grades;
const gradesClient = new gradesProto.GradesService(
  GRADES_GRPC_ADDR,
  grpc.credentials.createInsecure()
);

// =======================
// MIDDLEWARE
// =======================

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));
app.set('view engine', 'ejs');

const requireAuth = (req, res, next) => {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.redirect('/login');
  }
  next();
};

const getAuthHeader = (req) => {
  const token = req.cookies.auth_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Helper to decode token via Auth gRPC
const getUserFromToken = (req, callback) => {
  const token = req.cookies.auth_token;
  if (!token) {
    return callback(new Error('No token'), null);
  }

  authClient.ValidateToken({ token }, (err, response) => {
    if (err || !response?.valid) {
      return callback(err || new Error('Invalid token'), null);
    }
    callback(null, response); // { userId, role, name, valid: true }
  });
};

// =======================
// ROUTES
// =======================

app.get('/', (req, res) => {
  res.redirect('/login');
});

// ---------- PUBLIC ----------

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  authClient.Login({ username, password }, (err, response) => {
    if (err) {
      console.error('gRPC login error:', err);
      return res.render('login', { error: 'Auth service unavailable' });
    }

    if (!response.success) {
      return res.render('login', {
        error: response.message || 'Invalid credentials',
      });
    }

    res.cookie('auth_token', response.token, { httpOnly: true });

    if (response.role === 'faculty') {
      return res.redirect('/faculty/dashboard');
    }

    return res.redirect('/student/dashboard');
  });
});

app.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/login');
});

// ---------- STUDENT ----------

app.get('/student/dashboard', requireAuth, (req, res) => {
  res.render('student_dashboard');
});

// List open courses+sections
app.get('/student/courses', requireAuth, (req, res) => {
  courseClient.GetOpenCourses({}, (err, response) => {
    if (err) {
      console.error('gRPC GetOpenCourses error:', err);
      return res.render('error', { message: 'Could not fetch courses' });
    }

    // assuming course.proto has: repeated Course courses = 1;
    const courses = response?.courses || [];
    return res.render('student_courses', { courses });
  });
});

// Enroll in a section
app.post('/student/enroll', requireAuth, (req, res) => {
  const { sectionId } = req.body; 

  if (!sectionId) {
    return res.render('error', { message: 'Missing sectionId' });
  }

  getUserFromToken(req, (err, userInfo) => {
    if (err) {
      console.error('ValidateToken failed in /student/enroll:', err);
      return res.redirect('/login');
    }

    const studentId = userInfo.userId;

    enrollmentClient.EnrollStudent(
      {
        studentId,
        sectionId: Number(sectionId),
      },
      (err2, grpcResp) => {
        if (err2) {
          console.error('gRPC EnrollStudent error:', err2);
          return res.render('error', {
            message: 'Enrollment failed [server error]',
          });
        }

        if (!grpcResp.success) {
          return res.render('error', {
            message: grpcResp.message || 'Enrollment failed',
          });
        }

        return res.redirect('/student/enrollments/my');
      }
    );
  });
});

app.get('/student/enrollments/my', requireAuth, (req, res) => {
  getUserFromToken(req, (err, userInfo) => {
    if (err) {
      console.error('ValidateToken failed in /student/enrollments/my:', err);
      return res.redirect('/login');
    }

    const studentId = userInfo.userId;

    enrollmentClient.GetMyEnrollments({ studentId }, (err2, response) => {
      if (err2) {
        console.error('gRPC GetMyEnrollments error:', err2);
        return res.render('error', {
          message: 'Could not fetch enrollments',
        });
      }

      const enrollments = response?.enrollments || [];
      return res.render('student_enrollments', { enrollments });
    });
  });
});

app.get('/student/grades/my', requireAuth, async (req, res) => {
  getUserFromToken(req, (err, userInfo) => {

    if(err){
        console.error('ValidateToken failed in /student/grades/my:', err);
        return res.redirect('/login');
    }

    gradesClient.GetMyGrades(
        {studentId: userInfo.userId},
        (err2, response) => {
            if(err2){
                console.error('gRPC GetMyGrades error:', err2);
                return res.render('error', {message: 'Could not fetch grades'});
            }

            const grades = response?.grades || [];
            return res.render('student_grades', {grades});
        }
    );
  });
});

// ---------- FACULTY ----------

app.get('/faculty/dashboard', requireAuth, (req, res) => {
  getUserFromToken(req, (err, userInfo) => {
    if (err || userInfo.role !== 'faculty') {
      console.error('ValidateToken failed or not faculty:', err);
      return res.redirect('/login');
    }

    const facultyId = userInfo.userId;

    courseClient.GetFacultyCourses({ facultyId }, (err2, courseResp) => {
      if (err2) {
        console.error('gRPC GetFacultyCourses error:', err2);
        return res.render('error', {
          message: 'Could not fetch faculty dashboard',
        });
      }

      const courses = courseResp?.courses || [];
      return res.render('faculty_dashboard', { courses });
    });
  });
});

app.get('/faculty/sections/:sectionId', requireAuth, (req, res) => {
  const sectionId = Number(req.params.sectionId);

  enrollmentClient.GetSectionEnrollments({ sectionId }, (err, response) => {
    if (err) {
      console.error('gRPC GetSectionEnrollments error:', err);
      return res.render('error', { message: 'Could not load section' });
    }

    const enrollments = response?.enrollments || [];
    return res.render('faculty_section_grading', {
      students: enrollments,
      sectionId,
    });
  });
});

app.post('/faculty/grades/upload', requireAuth, (req, res) => {
  getUserFromToken(req, (err, userInfo) => {
    if (err || userInfo.role !== 'faculty') {
      console.error('ValidateToken failed or not faculty in /faculty/grades/upload:', err);
      return res.redirect('/login');
    }

    const { sectionId } = req.body;
    let { grades } = req.body;

    if(!grades){
        return res.redirect(`/faculty/sections/${sectionId}`);
    }
    if (!Array.isArray(grades)) {
      grades = Object.values(grades);
    }

    const payload = {
      sectionId: Number(sectionId),
      facultyId: userInfo.userId,
      grades: grades.map((g) => ({
        studentId: Number(g.studentId),
        grade: Number(g.grade),
      })),
    };

    gradesClient.UploadGrades(payload, (err2, grpcResp) => {
      if (err2) {
        console.error('gRPC UploadGrades error:', err2);
        return res.render('error', { message: 'Failed to upload grades' });
      }

      if (!grpcResp.success) {
        return res.render('error', { message: grpcResp.message || 'Failed to upload grades' });
      }

      return res.redirect('/faculty/dashboard');
    });
  });
});


app.listen(PORT, () => {
  console.log(`View Node running on port ${PORT}`);
});
