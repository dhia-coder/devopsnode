const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken"); // Ajouter pour générer un JWT
const router = express.Router();

// Lancer l'authentification Google
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Callback après l'auth Google
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Échec de l'authentification" });
    }

    // Création du JWT à partir des données de l'utilisateur Google
    const token = generateJwtToken(req.user.profile);

    // Renvoyer le JWT et les infos utilisateur au frontend
    res.json({
      token,
      user: {
        id: req.user.profile.id,
        email: req.user.profile.emails[0].value,
        name: req.user.profile.displayName,
      },
    });
  }
);

// Fonction pour générer un JWT
function generateJwtToken(userProfile) {
  const payload = {
    id: userProfile.id,  // ID de l'utilisateur Google
    email: userProfile.emails[0].value,
    name: userProfile.displayName,
    picture: userProfile.photos ? userProfile.photos[0].value : "", // Ajouter la photo de profil, si disponible
  };

  // Clé secrète pour signer le JWT
  const secretKey = 'ta-clé-secrète'; // Remplace par ta clé secrète
  const token = jwt.sign(payload, secretKey, { expiresIn: '1h' });  // Le token expire après 1 heure

  return token;
}

module.exports = router;

