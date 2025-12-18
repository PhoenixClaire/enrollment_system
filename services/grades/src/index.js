const express = require('express');
const { Pool } = require('pg');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const GRPC_PORT = process.env.GRPC_PORT || 7000;

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const PROTO_PATH = path.join(__dirname, 'grades.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const gradesProto = grpc.loadPackageDefinition(packageDef).grades; 

function mapRowToGrade(row){
    return{
        studentId: row.student_id,
        sectionId: row.section_id,
        courseId: row.course_id,
        courseCode: row.course_code,
        term: row.term,
        ay: row.ay,
        grade: row.grade,
    };
}

const gradesServiceImpl = {

    //student
    GetMyGrades: async (call, callback) => {

        const {studentId} = call.request;

        if (!studentId) return callback(null, {grades: []});

        try{
            const result = await pool.query(
                `SELECT 
                    g.student_id,
                    g.section_id,
                    g.course_id,
                    g.term,
                    g.ay,
                    g.grade,
                    c.code AS course_code
                FROM grades g
                JOIN sections s ON g.section_id = s.id
                JOIN courses c ON s.course_id = c.id
                WHERE g.student_id = $1`,
                [studentId]
            );

            const grades = result.rows.map(mapRowToGrade);
            callback(null, {grades});
        } catch (e){
            console.error('GetMyGrades error:', e);
            callback(null, {grades: []});
        }

    },

     //faculty
        UploadGrades: async(call, callback) => {
            
            const {sectionId, facultyId, grades} = call.request;

            if(!sectionId || !facultyId || !grades || grades.length === 0){
                return callback(null, {
                    success: false,
                    message: 'Missing sectionId, facultyId, or grades',
                });
            }

            try{
                for(const g of grades){
                    await pool.query(
                        `INSERT INTO grades (student_id, section_id, course_id, term, ay, grade, faculty_id)
                         VALUES ($1, $2, (SELECT course_id FROM sections WHERE id = $2),
                                'Term 1', '2025-2026', $3, $4)
                         ON CONFLICT (student_id, section_id)
                         DO UPDATE SET grade = EXCLUDED.grade, updated_at = NOW()`,
                         [g.studentId, sectionId, g.grade, facultyId]
                    );
                }

                callback(null, {success: true, message: 'Grades uploaded'});
            } catch (e) {
                console.error('UploadGrades error:', e);
                callback(null, {success: false, message: 'Upload error'});
            }
        }
};

function startGrpcServer(){

    const server = new grpc.Server();

    server.addService(gradesProto.GradesService.service, gradesServiceImpl);

     const addr = `0.0.0.0:${GRPC_PORT}`;
      server.bindAsync(
        addr,
        grpc.ServerCredentials.createInsecure(),
        (err) => {
          if (err) {
            console.error('Failed to start Grades gRPC server:', err);
            return;
          }
          console.log(`Grades gRPC server listening on ${addr}`);
          server.start();
        }
      );
}



startGrpcServer();
