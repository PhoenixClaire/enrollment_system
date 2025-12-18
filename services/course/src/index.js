const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Pool } = require('pg');

const GRPC_PORT = process.env.GRPC_PORT || 5000;

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const PROTO_PATH = path.join(__dirname, 'course.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const courseProto = grpc.loadPackageDefinition(packageDef).course;

const courseServiceImpl = {
  GetOpenCourses: async (call, callback) => {
    try {
      const result = await pool.query(
        `SELECT 
            c.id,
            c.code,
            c.title,
            c.units,
            c.status,
            c.capacity,
            u.name AS faculty_name,
            c.term,
            c.ay,
            s.id AS section_id,
            s.section_code
         FROM courses c
         JOIN users u ON c.faculty_id = u.id
         JOIN sections s ON s.course_id = c.id
         WHERE c.status = 'open' AND s.status = 'open'`
      );

      const courses = result.rows.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        units: r.units,
        status: r.status,
        capacity: r.capacity,
        facultyName: r.faculty_name,
        term: r.term,
        ay: r.ay,
        sectionId: r.section_id,
        sectionCode: r.section_code,
      }));

      callback(null, { courses });
    } catch (err) {
      console.error('GetOpenCourses error:', err);
      callback(err);
    }
  },

  GetFacultyCourses: async (call, callback) => {
    const { facultyId } = call.request;
    try {
      const result = await pool.query(
        `SELECT 
            c.id,
            c.code,
            c.title,
            c.units,
            c.status,
            c.capacity,
            u.name AS faculty_name,
            c.term,
            c.ay
         FROM courses c
         JOIN users u ON c.faculty_id = u.id
         WHERE c.faculty_id = $1`,
        [facultyId]
      );

      const courses = result.rows.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        units: r.units,
        status: r.status,
        capacity: r.capacity,
        facultyName: r.faculty_name,
        term: r.term,
        ay: r.ay,
      }));

      callback(null, { courses });
    } catch (err) {
      console.error('GetFacultyCourses error:', err);
      callback(err);
    }
  },
};

function startGrpcServer() {
  const server = new grpc.Server();
  server.addService(courseProto.CourseService.service, courseServiceImpl);

  const addr = `0.0.0.0:${GRPC_PORT}`;
  server.bindAsync(
    addr,
    grpc.ServerCredentials.createInsecure(),
    (err) => {
      if (err) {
        console.error('Failed to start Course gRPC server:', err);
        return;
      }
      console.log(`Course gRPC server listening on ${addr}`);
      server.start();
    }
  );
}

startGrpcServer();
