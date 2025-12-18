const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const GRPC_PORT = process.env.GRPC_PORT || 6000;

const PROTO_PATH = path.join(__dirname, 'enrollment.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const enrollmentProto = grpc.loadPackageDefinition(packageDef).enrollment;

function mapRowToEnrollment(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    sectionId: row.section_id,
    courseId: row.course_id,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    sectionCode: row.section_code,
    status: row.status,
    term: row.term,
    ay: row.ay,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    studentName: row.student_name,
    grade: row.grade !== null ? Number(row.grade) : null, 
  };
}

const enrollmentServiceImpl = {
  EnrollStudent: async (call, callback) => {
    // log to see what actually comes in
    console.log('EnrollStudent request:', call.request);

    // be generous with casing, just in case
    const studentId = call.request.studentId ?? call.request.student_id;
    const sectionId = call.request.sectionId ?? call.request.section_id;

    // only treat "missing" if null/undefined, not 0
    if (studentId == null || sectionId == null) {
      return callback(null, {
        success: false,
        message: 'Missing studentId or sectionId',
      });
    }

    try {
      const secRes = await pool.query(
        `SELECT s.id, s.status, s.capacity, COUNT(e.id) AS current_count
         FROM sections s
         LEFT JOIN enrollments e ON e.section_id = s.id
         WHERE s.id = $1
         GROUP BY s.id`,
        [sectionId]
      );

      if (secRes.rows.length === 0) {
        return callback(null, {
          success: false,
          message: 'Section not found',
        });
      }

      const sec = secRes.rows[0];

      if (sec.status !== 'open') {
        return callback(null, {
          success: false,
          message: 'Section is not open for enrollment',
        });
      }

      if (Number(sec.current_count) >= sec.capacity) {
        return callback(null, {
          success: false,
          message: 'Section is already full',
        });
      }

      await pool.query(
        `INSERT INTO enrollments (student_id, section_id, term, ay, status)
         VALUES ($1, $2, 'Term 1', '2025-2026', 'enrolled')`,
        [studentId, sectionId]
      );

      return callback(null, {
        success: true,
        message: 'Enrolled successfully',
      });
    } catch (err) {
      if (err.code === '23505') {
        return callback(null, {
          success: false,
          message: 'Student is already enrolled in this section',
        });
      }

      console.error('EnrollStudent error:', err);
      return callback(null, {
        success: false,
        message: 'Internal server error',
      });
    }
  },

  GetMyEnrollments: async (call, callback) => {
    const studentId = call.request.studentId ?? call.request.student_id;
    if (studentId == null) {
      return callback(null, { enrollments: [] });
    }

    try {
      const result = await pool.query(
        `SELECT 
           e.id,
           e.student_id,
           e.section_id,
           e.term,
           e.ay,
           e.status,
           e.created_at,
           s.course_id,
           s.section_code,
           c.code AS course_code,
           c.title AS course_title
         FROM enrollments e
         JOIN sections s ON e.section_id = s.id
         JOIN courses c ON s.course_id = c.id
         WHERE e.student_id = $1`,
        [studentId]
      );

      const enrollments = result.rows.map(mapRowToEnrollment);
      callback(null, { enrollments });
    } catch (err) {
      console.error('GetMyEnrollments error:', err);
      callback(null, { enrollments: [] });
    }
  },

  GetSectionEnrollments: async (call, callback) => {
    const sectionId = call.request.sectionId ?? call.request.section_id;
    if (sectionId == null) {
      return callback(null, { enrollments: [] });
    }

    try {
      const result = await pool.query(
        `SELECT 
          e.id,
          e.student_id,
          e.section_id,
          e.term,
          e.ay,
          e.status,
          e.created_at,
          s.course_id,
          s.section_code,
          c.code AS course_code,
          c.title AS course_title,
          u.name AS student_name,
          g.grade
        FROM enrollments e
        JOIN sections s ON e.section_id = s.id
        JOIN courses c ON s.course_id = c.id
        JOIN users u   ON e.student_id = u.id
        LEFT JOIN grades g 
          ON g.student_id = e.student_id 
          AND g.section_id = e.section_id
        WHERE e.section_id = $1`,
        [sectionId]
      );

      const enrollments = result.rows.map(mapRowToEnrollment);
      callback(null, { enrollments });
    } catch (err) {
      console.error('GetSectionEnrollments error:', err);
      callback(null, { enrollments: [] });
    }
  },
};

function startGrpcServer() {
  const server = new grpc.Server();
  server.addService(
    enrollmentProto.EnrollmentService.service,
    enrollmentServiceImpl
  );

  const addr = `0.0.0.0:${GRPC_PORT}`;
  server.bindAsync(
    addr,
    grpc.ServerCredentials.createInsecure(),
    (err) => {
      if (err) {
        console.error('Failed to start Enrollment gRPC server:', err);
        return;
      }
      console.log(`Enrollment gRPC server listening on ${addr}`);
      server.start();
    }
  );
}

startGrpcServer();
