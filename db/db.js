import mysql from "mysql2";
// config/db.js

// Create a connection to the database
const connection = mysql.createConnection({
  host: process.env.DB_HOST || "35.215.117.18",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "utpqnjtvt2ptg",
  password: process.env.DB_PASSWORD || ":2Gi#1$e13+[",
  database: process.env.DB_NAME || "dbnoig9i2v1oo0",
});

// $db_host      = 'localhost';
// $db_name      = 'dbnoig9i2v1oo0';
// $db_user      = 'utpqnjtvt2ptg';
// $db_user_pass = ':2Gi#1$e13+[';
// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err.stack);
    return;
  }
  console.log("Connected to the database");
});

export default connection;
