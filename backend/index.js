const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const helmet = require("helmet");
const fs = require("fs");
const https = require("https");

const sanitizeMiddleware = require("./middleware/sanitize");
const adminRouter = require("./routes/admin");
const usersRouter = require("./routes/users");
const authRouter = require("./routes/auth");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());

app.use(helmet.frameguard({ action: "deny" }));
app.use(helmet.noSniff());

const corsOptions = {
  origin: process.env.FRONTEND_ORIGIN || "https://localhost:4200",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

app.use(sanitizeMiddleware);

app.use("/api/admin", adminRouter);
app.use("/api/users", usersRouter);
app.use("/api", authRouter);

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

      https.createServer(httpsOptions, app).listen(port, () => {
        console.log(`Secure Server running on port ${port} (HTTPS)`);
      });
    } catch (error) {
      console.error(
        "Erreur lors du chargement des certificats SSL :",
        error.message
      );
      console.error(
        "Assurez-vous d'avoir généré les certificats dans backend/certs/ avec mkcert."
      );
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
