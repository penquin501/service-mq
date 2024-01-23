var mysql = require('mysql');
var connection = mysql.createPool({
    connectionLimit : 10,
    // host : process.env.MYSQL_HOST,
    // user : process.env.MYSQL_USERNAME,
    // password : process.env.MYSQL_PASSWORD,
    // database : process.env.MYSQL_DATABASE_NAME,
    host : '159.65.137.79',
    user : 'parceldev',
    password : '123456',
    database : 'parcel',
    debug : false,
    timezone : '+07:00'
});

module.exports = async function() {
    return connection;
}