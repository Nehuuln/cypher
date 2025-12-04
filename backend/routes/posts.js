const express = require("express");
const router = express.Router();
const multer = require("multer");
const { fileTypeFromBuffer } = require("file-type");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs").promises;
const os = require("os");
const path = require("path");
const ffprobeStatic = require("ffprobe-static");
const ffmpeg = require("fluent-ffmpeg");
const mongoose = require('mongoose');

ffmpeg.setFfprobePath(ffprobeStatic.path);

const Post = require("../models/Post");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

// allow larger uploads for short videos (up to ~50MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
}); // 50MB max

const allowedImageMime = ["image/jpeg", "image/png"];
const allowedVideoMime = ["video/mp4", "video/webm", "video/quicktime"];

// Create post. Auth required.
router.post("/", authMiddleware, upload.single("media"), async (req, res) => {
  try {
    const authorPayload = req.user;
    if (!authorPayload || !authorPayload.id)
      return res.status(401).json({ message: "Unauthorized" });

    const text = (req.body.text || "").toString().trim();
    const post = { text, author: authorPayload.id };

    if (req.file) {
      const ft = await fileTypeFromBuffer(req.file.buffer);
      if (!ft)
        return res
          .status(400)
          .json({ message: "Impossible de déterminer le type de fichier." });

      const mime = ft.mime;
      if (allowedImageMime.includes(mime)) {
        // image
        const ext = ft.ext;
        const filename = `${uuidv4()}.${ext}`;
        post.media = {
          data: req.file.buffer,
          contentType: mime,
          filename,
          size: req.file.size,
          kind: "image",
        };
      } else if (allowedVideoMime.includes(mime)) {
        // video
        const tmpPath = path.join(os.tmpdir(), `upload-${uuidv4()}.${ft.ext}`);
        await fs.writeFile(tmpPath, req.file.buffer);
        try {
          const metadata = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(tmpPath, (err, meta) => {
              if (err) return reject(err);
              resolve(meta);
            });
          });
          const duration =
            metadata.format && metadata.format.duration
              ? Number(metadata.format.duration)
              : 0;
          if (isNaN(duration) || duration > 60) {
            await fs.unlink(tmpPath).catch(() => {});
            return res.status(400).json({
              message: "La vidéo dépasse la durée autorisée (1 minute).",
            });
          }
          const ext = ft.ext;
          const filename = `${uuidv4()}.${ext}`;
          post.media = {
            data: req.file.buffer,
            contentType: mime,
            filename,
            size: req.file.size,
            kind: "video",
            duration,
          };
        } finally {
          await fs.unlink(tmpPath).catch(() => {});
        }
      } else {
        return res
          .status(400)
          .json({ message: "Type de fichier non autorisé." });
      }
    }

    const created = await Post.create(post);
    const populated = await Post.findById(created._id).populate(
      "author",
      "username tag"
    );
    return res.status(201).json({ post: populated });
  } catch (err) {
    console.error("POST /api/posts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/posts -> list posts (include likes count and comments populated)
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find()
      .select("-media.data")
      .sort({ createdAt: -1 })
      .populate("author", "username tag")
      .populate("comments.author", "username tag")
      .lean();

    const out = posts.map((p) => ({
      ...p,
      likesCount: (p.likes || []).length,
      likedByMe: false,
    }));

    return res.json({ posts: out });
  } catch (err) {
    console.error("GET /api/posts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/posts/:id/like -> add like (auth)
router.post("/:id/like", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;
    const updated = await Post.findByIdAndUpdate(
      postId,
      { $addToSet: { likes: userId } },
      { new: true }
    )
      .select("likes")
      .lean();
    if (!updated) return res.status(404).json({ message: "Post not found" });
    return res.json({ likesCount: (updated.likes || []).length });
  } catch (err) {
    console.error("POST /api/posts/:id/like error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/posts/:id/unlike -> remove like (auth)
router.post("/:id/unlike", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;
    const updated = await Post.findByIdAndUpdate(
      postId,
      { $pull: { likes: userId } },
      { new: true }
    )
      .select("likes")
      .lean();
    if (!updated) return res.status(404).json({ message: "Post not found" });
    return res.json({ likesCount: (updated.likes || []).length });
  } catch (err) {
    console.error("POST /api/posts/:id/unlike error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/posts/:id/comment -> add comment (auth)
router.post("/:id/comment", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;
    const text = (req.body.text || "").toString().trim();
    if (!text)
      return res.status(400).json({ message: "Comment text required" });

    const comment = { author: userId, text, createdAt: new Date() };
    const updated = await Post.findByIdAndUpdate(
      postId,
      { $push: { comments: comment } },
      { new: true }
    )
      .populate("comments.author", "username tag")
      .select("comments")
      .lean();
    if (!updated) return res.status(404).json({ message: "Post not found" });

    const added = (updated.comments || []).slice(-1)[0];
    return res.status(201).json({ comment: added });
  } catch (err) {
    console.error("POST /api/posts/:id/comment error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/media", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).select("media").lean();
    if (!post || !post.media || !post.media.data)
      return res.status(404).json({ message: "Media not found" });

    let dataBuf = null;
    const md = post.media;
    try {
      if (Buffer.isBuffer(md.data)) {
        dataBuf = md.data;
      } else if (md.data && md.data.buffer) {
        dataBuf = Buffer.from(md.data.buffer);
      } else if (md.data && Array.isArray(md.data.data)) {
        dataBuf = Buffer.from(md.data.data);
      } else if (Array.isArray(md.data)) {
        dataBuf = Buffer.from(md.data);
      } else if (typeof md.data === "string") {
        try {
          dataBuf = Buffer.from(md.data, "base64");
          if (!dataBuf || dataBuf.length === 0) dataBuf = Buffer.from(md.data);
        } catch (e) {
          dataBuf = Buffer.from(md.data);
        }
      }
    } catch (e) {
      console.error("Error normalizing post media data", e);
    }

    if (!dataBuf) {
      console.warn("Post media data could not be normalized", { id });
      return res.status(500).json({ message: "Media data invalid" });
    }

    const total = dataBuf.length;
    const contentType = md.contentType || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${md.filename || "media"}"`
    );
    res.setHeader("Accept-Ranges", "bytes");

    const range = req.headers.range;
    if (range && String(contentType).startsWith("video/")) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      if (isNaN(start) || isNaN(end) || start > end || start >= total) {
        res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
        return;
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
      res.setHeader("Content-Length", end - start + 1);
      return res.send(dataBuf.slice(start, end + 1));
    }

    res.setHeader("Content-Length", total);
    return res.send(dataBuf);
  } catch (err) {
    console.error("GET /api/posts/:id/media error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/posts/:id -> delete a post (admin only)
router.delete(
  "/:id",
  authMiddleware,
  authMiddleware.adminOnly,
  async (req, res) => {
    try {
      const postId = req.params.id;
      const deleted = await Post.findByIdAndDelete(postId);
      if (!deleted) return res.status(404).json({ message: "Post not found" });
      return res.json({ message: "Post deleted" });
    } catch (err) {
      console.error("DELETE /api/posts/:id error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// GET /api/posts/user/:id -> list posts by user
router.get("/user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    const authorId = mongoose.Types.ObjectId(id);

    const posts = await Post.find({ author: authorId })
      .select("-media.data")
      .sort({ createdAt: -1 })
      .populate("author", "username tag")
      .populate("comments.author", "username tag")
      .lean();

    const out = posts.map((p) => ({
      ...p,
      likesCount: (p.likes || []).length,
      likedByMe: false,
    }));

    return res.json({ posts: out });
  } catch (err) {
    console.error("GET /api/posts/user/:id error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
