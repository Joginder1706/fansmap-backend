import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import http from "http";
import db from "./db/db.js";
//routes
import userRoutes from "./routes/userRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());
app.use("/api", userRoutes);

// Create an HTTP server using the Express app
const server = http.createServer(app);

// Initialize Socket.IO with the server
const io = new Server(server, {
  cors: {
    origin: "https://www.fansmaps.com/messages",
    methods: ["GET", "POST"],
  },
});

app.get("/",(req,res)=>{
  res.send("fansmaps")
})

io.on("connection", (socket) => {
  // Join the user to a room based on their user ID
  socket.on("joinRoom", (userId) => {
    socket.join(userId);
    // console.log("joined room", userId);
  });

  socket.on("sendMessage", async (messageData) => {
    const {
      sender_id,
      receiver_id,
      message_text,
      image_url,
      last_message_timestamp,
    } = messageData;

    const chat_id =
      parseInt(sender_id) < parseInt(receiver_id)
        ? `${sender_id}-${receiver_id}`
        : `${receiver_id}-${sender_id}`;

    // *1. Validate Message Data*
    if (
      !sender_id ||
      !receiver_id ||
      !message_text ||
      !last_message_timestamp
    ) {
      socket.emit("errorMessage", { error: "All fields are required." });
      return;
    }

    if (typeof message_text !== "string" || message_text.length > 1000) {
      socket.emit("errorMessage", {
        error: "Message text is invalid or too long.",
      });
      return;
    }

    // *2. Check User Plan*
    const getPlanQuery = `SELECT DISTINCT plan FROM places WHERE userid = ? LIMIT 1`;
    db.query(getPlanQuery, [sender_id], (err, planResult) => {
      if (err) {
        console.log(err);
        socket.emit("errorMessage", {
          error: "Database error: " + err.message,
        });
        return;
      }

      if (planResult?.length > 0 && planResult[0].plan == 1) {
        // This is a free user, check the daily message limit
        const getLimitQuery = `SELECT free_messages_per_day FROM free_messages_limit LIMIT 1`;
        db.query(getLimitQuery, (err, limitResult) => {
          if (err) {
            console.log(err);
            socket.emit("errorMessage", {
              error: "Database error: " + err.message,
            });
            return;
          }

          if (limitResult?.length > 0) {
            const dailyLimit = limitResult[0].free_messages_per_day;

            const checkMessagesQuery = `
              SELECT COUNT(*) AS message_count
              FROM messages
              WHERE sender_id = ? 
              AND DATE(timestamp) = CURDATE()
            `;

            db.query(checkMessagesQuery, [sender_id], (err, countResult) => {
              if (err) {
                console.log(err);
                socket.emit("errorMessage", {
                  error: "Database error: " + err.message,
                });
                return;
              }

              const messageCount = countResult[0].message_count;

              if (messageCount >= dailyLimit) {
                socket.emit("errorMessage", {
                  error: "Messages have reached today's limit.",
                });
                return; // Stop further execution if the limit is reached
              }

              // *3. Save Message to the Database*
              const query = `
                INSERT INTO messages (sender_id, receiver_id, message_text, image_url, timestamp, is_read, is_pinned)
                VALUES (?, ?, ?, ?, NOW(), false, ?)
              `;

              db.query(
                query,
                [sender_id, receiver_id, message_text, image_url, 0],
                (err, result) => {
                  if (err) {
                    socket.emit("errorMessage", {
                      error: "Database error: " + err.message,
                    });
                    return;
                  }

                  const query1 = `
                    INSERT INTO chats (chat_id, user1_id, user2_id, last_message_id, last_message_timestamp)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    last_message_id = VALUES(last_message_id),
                    last_message_timestamp = VALUES(last_message_timestamp);
                  `;

                  db.query(
                    query1,
                    [
                      chat_id,
                      sender_id,
                      receiver_id,
                      result.insertId,
                      last_message_timestamp,
                    ],
                    (err, result) => {
                      if (err) {
                        console.log(err);
                        socket.emit("errorMessage", {
                          error: "Database error: " + err.message,
                        });
                        return;
                      }
                      // console.log("Message successfully saved.");
                    }
                  );

                  const newMessage = {
                    id: result.insertId,
                    sender_id,
                    receiver_id,
                    message_text,
                    image_url,
                    timestamp: new Date(),
                    is_read: false,
                    is_pinned: false,
                  };

                  // *4. Emit the Message to the Receiver*
                  io.to(sender_id).emit("receiveMessage", newMessage);
                  io.to(receiver_id).emit("receiveMessage", newMessage);
                }
              );
            });
          }
        });
      } else {
        // *3. Save Message to the Database* (For non-free users)
        let is_pinned = false;
        if (planResult?.length > 0) {
          is_pinned =
            planResult[0].plan == 6 || planResult[0].plan == 8 ? true : false;
        }
        // console.log(is_pinned, planResult[0]?.plan);
        const query = `
          INSERT INTO messages (sender_id, receiver_id, message_text, image_url, timestamp, is_read, is_pinned)
          VALUES (?, ?, ?, ?, NOW(), false, ?)
        `;

        db.query(
          query,
          [sender_id, receiver_id, message_text, image_url, is_pinned],
          (err, result) => {
            if (err) {
              socket.emit("errorMessage", {
                error: "Database error: " + err.message,
              });
              return;
            }

            const query1 = `
              INSERT INTO chats (chat_id, user1_id, user2_id, last_message_id, last_message_timestamp)
              VALUES (?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
              last_message_id = VALUES(last_message_id),
              last_message_timestamp = VALUES(last_message_timestamp);
            `;

            db.query(
              query1,
              [
                chat_id,
                sender_id,
                receiver_id,
                result.insertId,
                last_message_timestamp,
              ],
              (err, result) => {
                if (err) {
                  console.log(err);
                  socket.emit("errorMessage", {
                    error: "Database error: " + err.message,
                  });
                  return;
                }
                // console.log("Message successfully saved.");
              }
            );

            const newMessage = {
              id: result.insertId,
              sender_id,
              receiver_id,
              message_text,
              image_url,
              timestamp: new Date(),
              is_read: false,
              is_pinned: false,
            };

            // *4. Emit the Message to the Receiver*
            io.to(sender_id).emit("receiveMessage", newMessage);
            io.to(receiver_id).emit("receiveMessage", newMessage);
          }
        );
      }
    });
  });

  // When a message is read, unpin it if it was pinned
  socket.on("messageRead", (messageId) => {
    // console.log("unpinn");
    const unpinQuery = `
  UPDATE messages SET is_pinned = false WHERE id = ? AND is_pinned = true;
  `;

    db.query(unpinQuery, [messageId], (err, result) => {
      if (err) {
        console.log("Error unpinning message:", err.message);
      }
    });
  });

  // socket.on("messageRead", (messageId) => {
  //   console.log("read");
  //   // Update message status to 'read'
  //   const updateReadStatusQuery = `
  //     UPDATE messages
  //     SET is_read = true
  //     WHERE id = ?
  //   `;

  //   db.query(updateReadStatusQuery, [messageId], (err, result) => {
  //     if (err) {
  //       console.log(err);
  //       socket.emit("errorMessage", {
  //         error: "Database error: " + err.message,
  //       });
  //       return;
  //     }

  //     // Notify the sender that their message has been read
  //     const getMessageQuery = `
  //       SELECT sender_id
  //       FROM messages
  //       WHERE id = ?
  //     `;

  //     db.query(getMessageQuery, [messageId], (err, result) => {
  //       if (err) {
  //         console.log(err);
  //         socket.emit("errorMessage", {
  //           error: "Database error: " + err.message,
  //         });
  //         return;
  //       }

  //       if (result?.length > 0) {
  //         const senderId = result[0].sender_id;
  //         io.to(senderId).emit("messageReadReceipt", { messageId });
  //       }
  //     });
  //   });
  // });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
