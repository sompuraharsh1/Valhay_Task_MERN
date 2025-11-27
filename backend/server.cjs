// Core modules
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fse = require("fs-extra");

const app = express();
const PORT = 5000;

// Minimum allowed file size (5MB)
const MIN_FILE_BYTES = 5 * 1024 * 1024;

// Final uploads folder
const FINAL_DIR = path.join(__dirname, "uploaded_files");

// Temporary folder where chunks are stored
const TEMP_DIR = path.join(__dirname, "temp_parts");

// Ensure folders exist
fse.ensureDirSync(FINAL_DIR);
fse.ensureDirSync(TEMP_DIR);

app.use(cors());
app.use(express.json());

// Multer configuration (stores each chunk inside its temp folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = req.body.sessionId; 
    const tempPath = path.join(TEMP_DIR, id);
    fse.ensureDirSync(tempPath);
    cb(null, tempPath);
  },
  filename: (req, file, cb) => {
    cb(null, req.body.index); // save chunk using its index number
  },
});

const upload = multer({ storage });

// ---------------------------------------------------------
// Save a single chunk
// ---------------------------------------------------------
app.post("/upload/chunk", upload.single("data"), (req, res) => {
  return res.json({ message: "Chunk stored" });
});

// ---------------------------------------------------------
// Merge chunks into one final file
// ---------------------------------------------------------
app.post("/upload/finish", async (req, res) => {
  try {
    const { sessionId, total, fileName, fileSize } = req.body;

    // Reject small files (client should have already validated)
    if (fileSize < MIN_FILE_BYTES) {
      await fse.remove(path.join(TEMP_DIR, sessionId));
      return res.json({ message: "File must be larger than 5MB" });
    }

    const tempPath = path.join(TEMP_DIR, sessionId);
    const outputFile = path.join(
      FINAL_DIR,
      `${Date.now()}-${fileName}`
    );

    const finalStream = fs.createWriteStream(outputFile);

    // Append chunks one by one
    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(tempPath, `${i}`);
      const chunkBuffer = fs.readFileSync(chunkPath);
      finalStream.write(chunkBuffer);
    }

    finalStream.end();

    // When merging is complete
    finalStream.on("finish", async () => {
      await fse.remove(tempPath); // clear temp chunk folder
      return res.json({ message: "Upload completed successfully" });
    });
  } catch (err) {
    console.error("Error merging:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------
// Start backend
// ---------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
