const mysql = require('./backend/node_modules/mysql2');
const db = mysql.createConnection({ host:'localhost', port:3307, user:'root', password:'', database:'uni_diploma' });

db.connect(err => {
  if (err) { console.error(err.message); process.exit(1); }

  const sql = `INSERT INTO books (title, author, filename, uploaded_by, faculty, description, price, is_available, book_type, total_copies, available_copies, approved) VALUES
    ('Structural Analysis Fundamentals', 'Dr. Armen Hovhannisyan', 'sample1.pdf', 1, 'Structural Engineering', 'Core textbook covering static and dynamic structural analysis methods.', 0, 1, 'both', 5, 3, 1),
    ('Modern Architecture Design Principles', 'Prof. Lilit Sargsyan', 'sample2.pdf', 1, 'Architecture & Design', 'Comprehensive guide to contemporary architectural design theory.', 0, 1, 'online', 0, 0, 1),
    ('Urban Planning & Smart Cities', 'Dr. Gagik Petrosyan', 'sample3.pdf', 1, 'Urban Planning', 'Explores sustainable urban development and smart city technologies.', 2500, 1, 'physical', 3, 3, 1),
    ('Introduction to BIM Technology', 'Prof. Narine Mkrtchyan', 'sample4.pdf', 1, 'IT & Digital Tools', 'Building Information Modeling fundamentals for construction.', 0, 1, 'online', 0, 0, 1),
    ('Construction Project Management', 'Dr. Vazgen Harutyunyan', 'sample5.pdf', 1, 'Construction Management', 'Practical guide to managing large-scale construction projects.', 3500, 1, 'both', 4, 2, 1),
    ('Environmental Impact Assessment', 'Prof. Anahit Ghazaryan', 'sample6.pdf', 1, 'Environmental Engineering', 'Methods and case studies in environmental impact assessment.', 0, 1, 'physical', 2, 2, 1),
    ('Construction Economics', 'Dr. Tigran Margaryan', 'sample7.pdf', 1, 'Economics & Management', 'Financial analysis and cost estimation in construction.', 1800, 1, 'both', 6, 5, 1),
    ('Reinforced Concrete Design', 'Prof. Hayk Baghdasaryan', 'sample8.pdf', 1, 'Structural Engineering', 'Design principles for reinforced concrete structures per Armenian standards.', 0, 1, 'physical', 3, 0, 1),
    ('AutoCAD for Engineers', 'Dr. Sona Danielyan', 'sample9.pdf', 1, 'IT & Digital Tools', 'Step-by-step AutoCAD tutorials for civil engineering students.', 0, 1, 'online', 0, 0, 1),
    ('Seismic Resistant Design', 'Prof. Ruben Asatryan', 'sample10.pdf', 1, 'Structural Engineering', 'Earthquake-resistant building methods for the Armenian seismic zone.', 4000, 1, 'both', 7, 4, 1)`;

  db.query(sql, (err) => {
    if (err) console.error('Insert error:', err.message);
    else console.log('10 sample books inserted successfully!');
    db.end();
  });
});
