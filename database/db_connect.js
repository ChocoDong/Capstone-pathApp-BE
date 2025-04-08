const db = require('mysql2');

const conn = db.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'path',
    password: 'path',
    database: 'path',
});

module.exports = conn;
