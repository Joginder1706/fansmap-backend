import db from "../db/db.js";

export const getUserById = (req, res) => {
  const id = req.params.id;
  // console.log(id);
//   const query = `
//   SELECT DISTINCT
//     users.first_name, 
//     users.city_name, 
//     users.gender, 
//     users.created, 
//     users.active_date,
//     places.logo, 
//     places.description,
//     places.characters_description,
//     places.short_desc, 
//     places.details, 
//     places.healthtest_date
//   FROM users 
//   LEFT JOIN places 
//   ON users.id = places.userid 
//   WHERE users.id = ${id}
// `;

  const query = `SELECT * FROM places WHERE place_id=23825`;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err });
    }
    return res.json(results);
  });
};

export const getInboxMessages = (req, res) => {
  const id = req.query.userid;

  const query2 = `
      SELECT u.*
      FROM users u
      INNER JOIN (
        SELECT DISTINCT sender_id
        FROM messages
        WHERE receiver_id = ${id}
        ORDER BY id DESC
        LIMIT 15
      ) AS recent_senders
      ON u.id = recent_senders.sender_id;
    `;

  const q1 = `
    SELECT
      m.message_text
  FROM
      chats c
  JOIN
      messages m
  ON
      c.last_message_id = m.id
  WHERE
      (c.user1_id = ${id} OR c.user2_id = ${id})
  ORDER BY
      m.timestamp DESC;

    `;

    const query = `
  SELECT 
    u.*, 
    MAX(msg.is_pinned) AS is_pinned, 
    (SELECT m.message_text 
     FROM chats c
     JOIN messages m ON c.last_message_id = m.id
     WHERE (c.user1_id = ${id} OR c.user2_id = ${id})
     AND (c.user1_id = u.id OR c.user2_id = u.id)
     ORDER BY m.timestamp DESC
     LIMIT 1) AS last_message_text,
    MAX(msg.id) AS last_message_id
  FROM 
    messages msg
  JOIN 
    users u ON msg.sender_id = u.id
  WHERE 
    msg.receiver_id = ${id}
  GROUP BY 
    u.id
  ORDER BY 
    last_message_id DESC
  LIMIT 15;
`;

  
  //      msg.id DESC,

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    return res.json(results);
  });
};

export const getSentMessages = (req, res) => {
  const id = req.query;

  const q1 = `SELECT DISTINCT 
    u.*,
    (SELECT m.message_text 
     FROM chats c
     JOIN messages m ON c.last_message_id = m.id
     WHERE (c.user1_id = ${id.userid} OR c.user2_id = ${id.userid})
     AND (c.user1_id = u.id OR c.user2_id = u.id)
     ORDER BY m.timestamp DESC
     LIMIT 1) AS last_message_text
FROM 
    messages msg
JOIN 
    users u ON msg.receiver_id = u.id
WHERE 
    msg.sender_id = ${id.userid}
ORDER BY 
    msg.id DESC
LIMIT 15;
`;

  db.query(q1, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    return res.json(results);
  });
};

export const getSingleUserMessage = (req, res) => {
  const { id1, id2 } = req.params;
  const query = `
        SELECT * FROM messages 
        WHERE 
            (sender_id = ? AND receiver_id = ?) 
            OR 
            (sender_id = ? AND receiver_id = ?)
        ORDER BY timestamp ASC
    `;

  db.query(query, [id1, id2, id2, id1], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    return res.json(results);
  });
};
