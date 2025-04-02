// middleware/upload.js

const multer = require("multer");
const path = require("path");

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Dossier où seront enregistrés les fichiers
    // Vous pouvez mettre 'uploads/' ou un chemin plus spécifique (e.g. 'public/uploads/')
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Pour éviter les conflits de noms, on ajoute un timestamp
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// Filtrage des types de fichiers (facultatif, ici on accepte uniquement les images)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Limiter la taille des fichiers (par exemple à 2MB)
const limits = { fileSize: 2 * 1024 * 1024 }; // 2 MB

// Créer l'instance de Multer
const upload = multer({ storage, fileFilter, limits });

module.exports = upload;
