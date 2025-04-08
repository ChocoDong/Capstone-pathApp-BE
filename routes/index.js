var express = require('express');
var router = express.Router();
const db = require('../database/db_connect');

/* GET home page. */
router.get('/', function (req, res, next) {
    db.query('select * from member', (err, rows, fields) => {
        if (!err) {
            console.log('test / rows = ' + JSON.stringify(rows));
            res.json([{ code: 0, data: rows }]);
        } else {
            console.log('test / err = ' + err);
            res.json([{ code: 1, data: err }]);
        }
    });
});

module.exports = router;
