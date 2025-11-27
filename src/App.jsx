import { useState } from "react";
import "./App.css";

function App() {
  // file states
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [status, setStatus] = useState("");

  // size constraints
  const MIN_FILE_LIMIT = 5 * 1024 * 1024; // 5MB
  const SPLIT_SIZE = 2 * 1024 * 1024; // 2MB

  // When file is dropped in drag box
  const dropHandler = (event) => {
    event.preventDefault();
    setSelectedFile(event.dataTransfer.files[0]);
    setUploadPercent(0);
    setStatus("");
  };

  // Allow drag
  const dragAllow = (event) => event.preventDefault();

  // When user selects manually
  const manualSelect = (event) => {
    setSelectedFile(event.target.files[0]);
    setUploadPercent(0);
    setStatus("");
  };

  // Upload a single chunk to server
  const sendPart = async (
    blobPart,
    partNumber,
    uniqueId,
    totalParts,
    originalName,
    fileBytes
  ) => {
    const payload = new FormData();

    payload.append("sessionId", uniqueId);
    payload.append("index", partNumber);
    payload.append("total", totalParts);
    payload.append("name", originalName);
    payload.append("size", fileBytes);
    payload.append("data", blobPart);

    await fetch("http://localhost:5000/upload/chunk", {
      method: "POST",
      body: payload,
    });
  };

  // Main upload logic
  const startUpload = async () => {
    if (!selectedFile) return setStatus("Please choose a file.");
    if (selectedFile.size < MIN_FILE_LIMIT)
      return setStatus("File must be bigger than 5MB.");

    const session = Date.now().toString(); // unique ID
    const totalParts = Math.ceil(selectedFile.size / SPLIT_SIZE);

    setStatus("Uploading...");

    let partsDone = 0;

    for (let part = 0; part < totalParts; part++) {
      const startByte = part * SPLIT_SIZE;
      const stopByte = startByte + SPLIT_SIZE;

      const fileChunk = selectedFile.slice(startByte, stopByte);

      await sendPart(
        fileChunk,
        part,
        session,
        totalParts,
        selectedFile.name,
        selectedFile.size
      );

      partsDone++;
      setUploadPercent(Math.round((partsDone / totalParts) * 100));
    }

    // Notify server to join chunks
    const finalResponse = await fetch("http://localhost:5000/upload/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session,
        total: totalParts,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      }),
    });

    const result = await finalResponse.json();
    setStatus(result.message);
  };

  return (
    <div className="container">
      <h2>Chunk File Uploader</h2>

      {/* Drag & Drop zone */}
      <div className="drop-area" onDrop={dropHandler} onDragOver={dragAllow}>
        <p>Drop large files here</p>
        <p>or</p>
        <input type="file" onChange={manualSelect} />
      </div>

      {/* File name + size */}
      {selectedFile && (
        <p className="file-details">
          {selectedFile.name} — {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
        </p>
      )}

      {/* Upload button */}
      <button className="btn" onClick={startUpload}>
        Start Upload
      </button>

      {/* Progress bar */}
      {uploadPercent > 0 && (
        <div className="progress-wrapper">
          <div
            className="progress-bar"
            style={{ width: uploadPercent + "%" }}
          ></div>
        </div>
      )}

      {/* Status Text */}
      <p className="status-msg">{status}</p>
    </div>
  );
}

export default App;
