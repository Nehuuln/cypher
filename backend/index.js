const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Remplacez l'appel générique à cors() par une configuration qui autorise l'origine et les credentials
const corsOptions = {
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:4200',
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // pour préflight OPTIONS
app.use(cookieParser());
app.use(express.json());

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI;
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Routes
const authRouter = require('./routes/auth');
app.use('/api', authRouter);

app.get('/', (req, res) => {
  res.send({ status: 'ok', message: 'API root' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
