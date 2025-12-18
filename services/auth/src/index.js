const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const GRPC_PORT = process.env.GRPC_PORT || 4000;

//load proto
const PROTO_PATH = path.join(__dirname, 'auth.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,  // Fixed typo: 'long' -> 'longs'
    enums: String,
    defaults: true,
    oneofs: true 
});

const authProto = grpc.loadPackageDefinition(packageDef).auth;

const authServiceImpl = {

    //view-node logs in 
    Login: async (call, callback) => {
        const { username, password } = call.request; 

        try{
            const result = await pool.query(
                'SELECT id, username, password_hash, role, name FROM users WHERE username = $1',
                [username]
            );

            if (result.rowCount == 0){
                return callback(null, {
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            const user = result.rows[0];

            //temp plain text check 
            if(user.password_hash !== password){
                return callback(null, {
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            const token = jwt.sign(
                { sub: user.id, role: user.role },
                JWT_SECRET,
                { expiresIn: '1h'}
            );

            callback(null, {
                success: true,
                token,
                role: user.role,
                name: user.name,
                message: 'Login successful'
            });
        } catch (err) {
            console.error('Login error: ', err);
            callback(null, {
                success: false,
                message: 'Internal server error'
            });
        }
    },

    ValidateToken: async (call, callback) => {
        const { token } = call.request;

        if (!token){
            return callback(null, {
                valid: false
            });
        }

        try{
            const payload = jwt.verify(token, JWT_SECRET);
            const result = await pool.query(
                'SELECT id, role, name FROM users WHERE id = $1',
                [payload.sub]
            );

            if(result.rowCount === 0){
                return callback(null, {
                    valid: false 
                });
            }

            const user = result.rows[0];

            callback(null, {
                valid: true,
                userId: user.id,
                role: user.role,
                name: user.name 
            });
        } catch (err) {
            console.error('ValidateToken error: ', err);
            callback(null, {
                valid: false 
            });
        }
    }
};

function startGrpcServer(){
    const server = new grpc.Server();

    server.addService(authProto.AuthService.service, authServiceImpl);
    const addr = `0.0.0.0:${GRPC_PORT}`;

    server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            console.error('Failed to start gRPC server ', err);
            return;
        }
        console.log(`Auth gRPC server listening on ${addr}`);
        server.start();
    });
}

startGrpcServer(); 