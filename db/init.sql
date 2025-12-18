-- db/init.sql

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'faculty')),
    name TEXT NOT NULL
);

-- 2. COURSES
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    units INT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    capacity INT DEFAULT 40,
    faculty_id INT REFERENCES users(id),
    term VARCHAR(20) NOT NULL,
    ay VARCHAR(20) NOT NULL
);

-- 3. SECTIONS
CREATE TABLE IF NOT EXISTS sections (
    id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(id),
    section_code VARCHAR(20) NOT NULL,
    faculty_id INT REFERENCES users(id),
    term VARCHAR(20) NOT NULL,
    ay VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    capacity INT DEFAULT 40
);

-- 4. ENROLLMENTS
CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES users(id),
    section_id INT REFERENCES sections(id),
    term VARCHAR(20) NOT NULL,
    ay VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'enrolled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, section_id)
);

-- 5. GRADES
CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES users(id),
    section_id INT REFERENCES sections(id),
    course_id INT REFERENCES courses(id),
    term VARCHAR(20) NOT NULL,
    ay VARCHAR(20) NOT NULL,
    grade NUMERIC(4, 2),
    faculty_id INT REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, section_id)
);

-- SEED DATA
INSERT INTO users (username, password_hash, role, name) VALUES
  ('harry',    'hedwig0731', 'student', 'Harry Potter'),
  ('hermione', 'password', 'student', 'Hermione Granger'),
  ('ron',      'password', 'student', 'Ron Weasley'),
  ('luna',     'password', 'student', 'Luna Lovegood'),
  ('neville',  'password', 'student', 'Neville Longbottom'),
  ('draco',    'password', 'student', 'Draco Malfoy'),

  ('dumbledore', 'Not2dayVoldy', 'faculty', 'Albus Dumbledore'),
  ('lupin',      'UncleMoony', 'faculty', 'Remus Lupin'),
  ('hagrid',     'password', 'faculty', 'Rubeus Hagrid'),
  ('flitwick',   'password', 'faculty', 'Filius Flitwick'),
  ('trelawney',  'password', 'faculty', 'Sybill Trelawney'),
  ('sprout',     'password', 'faculty', 'Pomona Sprout'),
  ('binns',      'password', 'faculty', 'Cuthbert Binns')

ON CONFLICT (username) DO NOTHING;

-- Seed Course and Section
DO $$
DECLARE 
    f_snape        INT;
    f_mcgonagall   INT;
    f_dumbledore   INT;
    f_lupin        INT;
    f_hagrid       INT;
    f_flitwick     INT;
    f_trelawney    INT;
    f_sprout       INT;
    f_binns        INT;

    c_dada  INT; c_potions INT; c_transfig INT; c_charms INT;
    c_creatures INT; c_divination INT; c_herbology INT; c_history INT;
BEGIN
    -- Get Faculty IDs
    SELECT id INTO f_dumbledore FROM users WHERE username = 'dumbledore';
    SELECT id INTO f_lupin      FROM users WHERE username = 'lupin';
    SELECT id INTO f_hagrid     FROM users WHERE username = 'hagrid';
    SELECT id INTO f_flitwick   FROM users WHERE username = 'flitwick';
    SELECT id INTO f_trelawney  FROM users WHERE username = 'trelawney';
    SELECT id INTO f_sprout     FROM users WHERE username = 'sprout';
    SELECT id INTO f_binns      FROM users WHERE username = 'binns';
    
    INSERT INTO courses (code, title, units, status, capacity, faculty_id, term, ay)
    VALUES ('DADA101', 'Defense Against the Dark Arts', 3, 'open', 30, f_lupin, 'Term 1', '2025-2026')
    ON CONFLICT DO NOTHING RETURNING id INTO c_dada;

    INSERT INTO courses (code, title, units, status, capacity, faculty_id, term, ay)
    VALUES ('POT101', 'Potions', 3, 'open', 25, f_snape, 'Term 1', '2025-2026')
    ON CONFLICT DO NOTHING RETURNING id INTO c_potions;

    INSERT INTO courses (code, title, units, status, capacity, faculty_id, term, ay)
    VALUES ('TRN101', 'Transfiguration', 3, 'open', 30, f_mcgonagall, 'Term 1', '2025-2026')
    ON CONFLICT DO NOTHING RETURNING id INTO c_transfig;

    INSERT INTO courses (code, title, units, status, capacity, faculty_id, term, ay)
    VALUES ('CHR101', 'Charms', 3, 'open', 30, f_flitwick, 'Term 1', '2025-2026')
    ON CONFLICT DO NOTHING RETURNING id INTO c_charms;

    INSERT INTO courses (code, title, units, status, capacity, faculty_id, term, ay)
    VALUES ('CMC101', 'Care of Magical Creatures', 2, 'open', 20, f_hagrid, 'Term 1', '2025-2026')
    ON CONFLICT DO NOTHING RETURNING id INTO c_creatures;

    INSERT INTO courses (code, title, units, status, capacity, faculty_id, term, ay)
    VALUES ('DIV101', 'Divination', 2, 'open', 20, f_trelawney, 'Term 1', '2025-2026')
    ON CONFLICT DO NOTHING RETURNING id INTO c_divination;

    INSERT INTO courses (code, title, units, status, capacity, faculty_id, term, ay)
    VALUES ('HRB101', 'Herbology', 2, 'open', 25, f_sprout, 'Term 1', '2025-2026')
    ON CONFLICT DO NOTHING RETURNING id INTO c_herbology;

    INSERT INTO courses (code, title, units, status, capacity, faculty_id, term, ay)
    VALUES ('HIS101', 'History of Magic', 2, 'open', 40, f_binns, 'Term 1', '2025-2026')
    ON CONFLICT DO NOTHING RETURNING id INTO c_history;

    -- Create Sections if courses were inserted
    IF c_dada IS NOT NULL THEN
        INSERT INTO sections (course_id, section_code, faculty_id, term, ay, status, capacity)
        VALUES (c_dada, 'DADA-1', f_lupin, 'Term 1', '2025-2026', 'open', 30);
    END IF;

    IF c_potions IS NOT NULL THEN
        INSERT INTO sections (course_id, section_code, faculty_id, term, ay, status, capacity)
        VALUES (c_potions, 'POT-1', f_snape, 'Term 1', '2025-2026', 'open', 25);
    END IF;

    IF c_transfig IS NOT NULL THEN
        INSERT INTO sections (course_id, section_code, faculty_id, term, ay, status, capacity)
        VALUES (c_transfig, 'TRN-1', f_mcgonagall, 'Term 1', '2025-2026', 'open', 30);
    END IF;

    IF c_charms IS NOT NULL THEN
        INSERT INTO sections (course_id, section_code, faculty_id, term, ay, status, capacity)
        VALUES (c_charms, 'CHR-1', f_flitwick, 'Term 1', '2025-2026', 'open', 30);
    END IF;

    IF c_creatures IS NOT NULL THEN
        INSERT INTO sections (course_id, section_code, faculty_id, term, ay, status, capacity)
        VALUES (c_creatures, 'CMC-1', f_hagrid, 'Term 1', '2025-2026', 'open', 20);
    END IF;

    IF c_divination IS NOT NULL THEN
        INSERT INTO sections (course_id, section_code, faculty_id, term, ay, status, capacity)
        VALUES (c_divination, 'DIV-1', f_trelawney, 'Term 1', '2025-2026', 'open', 20);
    END IF;

    IF c_herbology IS NOT NULL THEN
        INSERT INTO sections (course_id, section_code, faculty_id, term, ay, status, capacity)
        VALUES (c_herbology, 'HRB-1', f_sprout, 'Term 1', '2025-2026', 'open', 25);
    END IF;

    IF c_history IS NOT NULL THEN
        INSERT INTO sections (course_id, section_code, faculty_id, term, ay, status, capacity)
        VALUES (c_history, 'HIS-1', f_binns, 'Term 1', '2025-2026', 'open', 40);
    END IF;
END $$;