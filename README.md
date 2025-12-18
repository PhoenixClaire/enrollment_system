# STDISCM-P4: Distributed Fault Tolerance

A fault-tolerant, distributed online enrollment system built with **Node.js**, **Express**, **gRPC**, and **PostgreSQL**, containerized using **Docker**.

The system consists of **6 isolated nodes** communicating primarily via **gRPC** to ensure type-safe, high-performance communication and fault isolation.

---

## I. System Architecture

The application is split into microservices (Nodes) as defined in the project specifications:

| Node | Type | Description |
| :--- | :--- | :--- |
| **View Node** | Frontend | Serves HTML/CSS/EJS. Acts as the Client/Gateway. |
| **Auth Service** | Backend | Handles Login, Token Generation, and Validation via **gRPC**. |
| **Course Service** | Backend | Manages course data and availability via **gRPC**. |
| **Enrollment Service** | Backend | Handles student course registration via **gRPC**. |
| **Grades Service** | Backend | Manages grading records uploaded by faculty via **gRPC**. |
| **Database Node** | Persistence | A shared PostgreSQL instance containing schemas for all services. |

### Communication Flow
1.  **User** interacts with **View Node** via Browser (HTTP).
2.  **View Node** connects to **Backend Services** (Auth, Course, Enrollment, Grades) using **gRPC Clients**.
3.  **Backend Services** also communicate internally using **gRPC** (e.g., Enrollment Service checks Auth Service to validate tokens).

---

## II. How to Run

You only need **Docker Desktop** installed. No local Node.js or PostgreSQL installation is required.

### 1. Build and Start
1.  Navigate to the frontend folder and install dependencies:
```bash
cd frontend
npm install
```
2. Go back to project root folder and run:
```bash
docker compose up --build
```
*Wait until you see the message View Node running on port 3000.*

---

### 2. Access the Application
Open your web browser and go to: **http://localhost:3000**

### 3. Stop the System
To stop all containers:
```bash
docker compose down
```

### 4. Resetting Data
If you want to wipe the database and reset it to the initial seed data:
```bash
docker compose down -v
```
*(The -v flag removes the database volume, forcing a re-seed on the next start).*

## III. Key Pages & Routes

### Public
* `/login` - Login form (Auth Service integration).
* `/logout` - Clears auth cookie.

### Student Portal
* `/student/dashboard` - Main student menu.
* `/student/courses` - View open courses and enroll.
* `/student/enrollments/my` - View current active classes.
* `/student/grades/my` - View grade history.

### Faculty Portal
* `/faculty/dashboard` - View assigned courses.
* `/faculty/sections/:sectionId` - Manage grades for a specific class.

---

## IV. Configuration
The frontend connects to backend services using gRPC Addresses defined in `docker-compose.yml`.

* `AUTH_URL` (Default: `http://localhost:4000`)
* `COURSE_URL` (Default: `http://localhost:5000`)
* `ENROLL_URL` (Default: `http://localhost:6000`)
* `GRADES_URL` (Default: `http://localhost:7000`)

* `AUTH_GRPC_ADDR` (Default: `auth-service:4000`)
* `COURSE_GRPC_ADDR` (Default: `course-service:5000`)
* `ENROLL_GRPC_ADDR` (Default: `enrollment-service:6000`)
* `GRADES_GRPC_ADDR` (Default: `grades-service:7000`)
---

## V. Project Structure

```bash
/
├── docker-compose.yml      # Network orchestration for all 6 nodes
├── db/
│   └── init.sql            # Database schema and seed data script
├── frontend/               # [VIEW NODE] Express + EJS
│   ├── server.js           # Main Server & gRPC Clients
│   ├── views/              # HTML Templates
│   └── proto/              # Shared gRPC definitions
└── services/               # [BACKEND NODES]
    ├── auth/               # Auth Service (gRPC server)
    ├── course/             # Course Service (gRPC server)
    ├── enrollment/         # Enrollment Service (gRPC server)
    └── grades/             # Grades Service (gRPC server)
```
