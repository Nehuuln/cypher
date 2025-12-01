const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const helmet = require("helmet");
const fs = require("fs");
const https = require("https");

const sanitizeMiddleware = require("./middleware/sanitize");
const messagesRouter = require("./routes/messages");
const adminRouter = require("./routes/admin");
const usersRouter = require("./routes/users");
const authRouter = require("./routes/auth");
const errorHandler = require("./middleware/errorHandler");

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(helmet.frameguard({ action: "deny" }));
app.use(helmet.noSniff());

// Normalize FRONTEND origins (allow comma-separated), remove trailing slash
const rawFrontend = process.env.FRONTEND_ORIGIN || "https://localhost:4200";
const ALLOWED_ORIGINS = String(rawFrontend)
  .split(",")
  .map(s => s.trim().replace(/\/+$/g, "")) // remove trailing slash(es)
  .filter(Boolean);

// CORS configuration: dynamic origin check
const corsOptions = {
  origin: function (origin, callback) {
    // allow non-browser tools (curl, postman) with no origin
    if (!origin) return callback(null, true);
    const cleaned = String(origin).replace(/\/+$/g, "");
    if (ALLOWED_ORIGINS.includes(cleaned)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

// extra safety: reflect allowed origin (use request origin when allowed)
app.use((req, res, next) => {
  const origin = req.headers.origin ? String(req.headers.origin).replace(/\/+$/g, "") : "";
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // fallback to first allowed origin (safe default)
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS[0] || "");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(sanitizeMiddleware);

// Routes (after middleware)
app.use("/api/messages", messagesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/users", usersRouter);
app.use("/api", authRouter);

app.use(errorHandler);

// Connexion MongoDB et démarrage du serveur HTTPS + Socket.IO
const mongoUri = process.env.MONGODB_URI;
mongoose.set("strictQuery", false);

if (!mongoUri) {
  console.error(
    "MONGODB_URI is not set. Set it in your environment or in backend/.env"
  );
  process.exit(1);
}

mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    console.log("Connected to MongoDB");

    try {
      const httpsOptions = {
        key: fs.readFileSync("./certs/localhost+1-key.pem"),
        cert: fs.readFileSync("./certs/localhost+1.pem"),
      };

      // create HTTPS server and attach Socket.IO with proper CORS
      const server = https.createServer(httpsOptions, app);
      const { Server } = require("socket.io");
      const io = new Server(server, {
        cors: {
          origin: ALLOWED_ORIGINS,
          methods: ["GET", "POST"],
          credentials: true
        }
      });

      // expose io to routes
      app.set("io", io);

      io.on("connection", (socket) => {
        socket.on("identify", (userId) => {
          if (userId) socket.join(String(userId));
        });
      });

      server.listen(port, () => {
        console.log(`Secure Server running on port ${port} (HTTPS + Socket.IO)`);
      });
    } catch (error) {
      console.error("Erreur lors du chargement des certificats SSL :", error.message);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
