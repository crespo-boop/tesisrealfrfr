const mysql = require('mysql');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      
    password: '2002',      
    database: 'tesis'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Conectado a la base de datos MySQL');
});

module.exports = db;
