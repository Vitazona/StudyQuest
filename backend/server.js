
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const bcrypt = require("bcrypt");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const {
  MongoClient,
  ObjectId,
  GridFSBucket
} = require("mongodb");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_NAME = process.env.MONGODB_DB || "studyquest";
const SESSION_SECRET = process.env.SESSION_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;
const curriculumContentTypes = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required. Set it in backend/.env.");
}

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required. Set it in backend/.env.");
}

const client = new MongoClient(MONGODB_URI);

app.use(
  session({
    name: "studyquest.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      client,
      dbName: DATABASE_NAME,
      collectionName: "sessions"
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

// Database collections and GridFS bucket.
let users;
let curriculumBucket;

// Upload configuration: maximum 15 MB per file.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = {
      ".pdf": ["application/pdf"],
      ".jpg": ["image/jpeg"],
      ".jpeg": ["image/jpeg"],
      ".png": ["image/png"],
      ".webp": ["image/webp"]
    };

    const extension = path.extname(file.originalname).toLowerCase();
    const allowedMimeTypes = allowedTypes[extension];

    if (
      !allowedMimeTypes ||
      !allowedMimeTypes.includes(file.mimetype)
    ) {
      const error = new Error(
        "Only PDF, JPG, JPEG, PNG, and WEBP files are allowed."
      );
      error.code = "INVALID_FILE_TYPE";
      return callback(error);
    }

    callback(null, true);
  }
});

// Authentication middleware.
function requireLogin(req, res, next) {
  if (
    !req.session.userId ||
    !ObjectId.isValid(req.session.userId)
  ) {
    return res.status(401).json({
      message: "Please log in to access this feature."
    });
  }

  next();
}

// Health check.
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ========================================
// AUTHENTICATION: REGISTER
// ========================================

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const body = req.body || {};

    const username =
      typeof body.username === "string"
        ? body.username.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const confirmPassword =
      typeof body.confirmPassword === "string"
        ? body.confirmPassword
        : "";

    if (!/^[a-zA-Z0-9_]{5,30}$/.test(username)) {
      return res.status(400).json({
        message:
          "Username must be 5-30 characters and use only letters, numbers, or underscores."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254) {
      return res.status(400).json({
        message: "Enter a valid email address."
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match."
      });
    }

    const strongPassword =
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password);

    if (
      password.length < 8 ||
      !strongPassword ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a symbol. It must not exceed 72 bytes."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await users.insertOne({
      username,
      usernameLower: username.toLowerCase(),
      email,
      passwordHash,
      createdAt: new Date()
    });

    return res.status(201).json({
      message: "Account created. You can now log in.",
      user: {
        id: result.insertedId.toString(),
        username,
        email
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(
        error.keyPattern || {}
      )[0];

      const message =
        duplicateField === "email"
          ? "That email address is already registered."
          : "That username is already taken.";

      return res.status(409).json({ message });
    }

    next(error);
  }
});

// ========================================
// AUTHENTICATION: LOGIN
// ========================================

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const body = req.body || {};

    const login =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!login || !password) {
      return res.status(400).json({
        message: "Enter your username and password."
      });
    }

    const user = await users.findOne({
      $or: [
        { usernameLower: login },
        { email: login }
      ]
    });

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        message: "Incorrect username/email or password."
      });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate(error =>
        error ? reject(error) : resolve()
      );
    });

    req.session.userId = user._id.toString();

    await new Promise((resolve, reject) => {
      req.session.save(error =>
        error ? reject(error) : resolve()
      );
    });

    return res.json({
      message: "Login successful.",
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

// ========================================
// AUTHENTICATION: CURRENT USER
// ========================================

app.get("/api/auth/me", async (req, res, next) => {
  try {
    if (
      !req.session.userId ||
      !ObjectId.isValid(req.session.userId)
    ) {
      return res.status(401).json({
        message: "You are not logged in."
      });
    }

    const user = await users.findOne(
      { _id: new ObjectId(req.session.userId) },
      { projection: { username: 1, email: 1 } }
    );

    if (!user) {
      return res.status(401).json({
        message: "Your account could not be found."
      });
    }

    return res.json({
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

// ========================================
// AUTHENTICATION: LOGOUT
// ========================================

app.post("/api/auth/logout", (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);

    res.clearCookie("studyquest.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    return res.json({ message: "Logged out." });
  });
});

// ========================================
// GRIDFS: UPLOAD CURRICULUM FILE
// ========================================

app.post(
  "/api/curriculum/upload",
  requireLogin,
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Please select a file to upload."
        });
      }

      const userId = req.session.userId;

      const safeFilename = path
        .basename(req.file.originalname)
        .replace(/[\r\n"]/g, "_");

      const stream = curriculumBucket.openUploadStream(
        safeFilename,
        {
          contentType: req.file.mimetype,
          metadata: {
            userId,
            originalName: safeFilename,
            uploadedAt: new Date()
          }
        }
      );

      stream.on("error", next);

      stream.on("finish", () => {
        if (res.headersSent) return;

        return res.status(201).json({
          message: "Curriculum file uploaded successfully.",
          file: {
            id: stream.id.toString(),
            filename: safeFilename,
            contentType: req.file.mimetype,
            size: req.file.size
          }
        });
      });

      stream.end(req.file.buffer);
    } catch (error) {
      next(error);
    }
  }
);

// ========================================
// GRIDFS: LIST THE CURRENT USER'S FILES
// ========================================

app.get(
  "/api/curriculum",
  requireLogin,
  async (req, res, next) => {
    try {
      const files = await curriculumBucket
        .find({
          "metadata.userId": req.session.userId
        })
        .sort({ uploadDate: -1 })
        .toArray();

      return res.json({
        files: files.map(file => ({
          id: file._id.toString(),
          filename:
            file.metadata?.originalName || file.filename,
          contentType: file.contentType,
          size: file.length,
          uploadedAt:
            file.metadata?.uploadedAt || file.uploadDate
        }))
      });
    } catch (error) {
      next(error);
    }
  }
);

// ========================================
// GRIDFS: VIEW OR DOWNLOAD A FILE
// ========================================

app.get(
  "/api/curriculum/:id",
  requireLogin,
  async (req, res, next) => {
    try {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          message: "Invalid file ID."
        });
      }

      const fileId = new ObjectId(req.params.id);

      const files = await curriculumBucket
        .find({
          _id: fileId,
          "metadata.userId": req.session.userId
        })
        .toArray();

      if (!files.length) {
        return res.status(404).json({
          message:
            "File not found or you do not have permission to access it."
        });
      }

      const file = files[0];

      const filename = path
        .basename(file.metadata?.originalName || file.filename)
        .replace(/[\r\n"]/g, "_");

      res.setHeader(
        "Content-Type",
        curriculumContentTypes[path.extname(filename).toLowerCase()] ||
          file.contentType ||
          "application/octet-stream"
      );

      const disposition =
        req.query.download === "1"
          ? "attachment"
          : "inline";

      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${filename}"`
      );

      const downloadStream =
        curriculumBucket.openDownloadStream(fileId);

      await pipeline(downloadStream, res);
    } catch (error) {
      if (res.headersSent) return;
      next(error);
    }
  }
);

// ========================================
// GRIDFS: DELETE A FILE
// ========================================

app.delete(
  "/api/curriculum/:id",
  requireLogin,
  async (req, res, next) => {
    try {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          message: "Invalid file ID."
        });
      }

      const fileId = new ObjectId(req.params.id);

      const file = await curriculumBucket
        .find({
          _id: fileId,
          "metadata.userId": req.session.userId
        })
        .toArray();

      if (!file.length) {
        return res.status(404).json({
          message:
            "File not found or you do not have permission to delete it."
        });
      }

      await curriculumBucket.delete(fileId);

      return res.json({
        message: "Curriculum file deleted successfully."
      });
    } catch (error) {
      next(error);
    }
  }
);

// ========================================
// WEBSITE ROUTES AND STATIC FILES
// ========================================

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

app.use("/backend", (req, res) => {
  res.sendStatus(404);
});

app.use(express.static(path.join(__dirname, "..")));

// ========================================
// ERROR HANDLER
// ========================================

app.use((error, req, res, next) => {
  console.error("Request failed:", error);

  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    const status =
      error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

    return res.status(status).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "File is too large. The maximum size is 15 MB."
          : error.message
    });
  }

  if (error.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({
      message: error.message
    });
  }

  return res.status(500).json({
    message: "An unexpected server error occurred."
  });
});

// ========================================
// START SERVER AND CONNECT TO MONGODB
// ========================================

async function startServer() {
  await client.connect();

  const database = client.db(DATABASE_NAME);

  await database.command({ ping: 1 });

  users = database.collection("users");

  await users.createIndex(
    { usernameLower: 1 },
    { unique: true }
  );

  await users.createIndex(
    { email: 1 },
    { unique: true }
  );

  // GridFS uses the same database as the user accounts.
  curriculumBucket = new GridFSBucket(database, {
    bucketName: "curriculum"
  });

  app.listen(PORT, () => {
    console.log(
      `Study Quest is running at http://localhost:${PORT}`
    );
    console.log(
      `Connected to MongoDB database "${DATABASE_NAME}".`
    );
    console.log("GridFS curriculum storage is ready.");
  });
}

startServer().catch(error => {
  console.error("Could not start Study Quest:", error);
  process.exitCode = 1;
});
