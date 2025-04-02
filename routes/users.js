var express=require('express');
const router = express.Router();
const userController=require('../controllers/UserController');
// Import de votre config Multer
const upload = require("../Middleware/Upload");


// Use Multer to handle file uploads for both "photo" and "image_carte_etudiant"
router.post(
  '/create',
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "image_carte_etudiant", maxCount: 1 }
  ]),
  userController.addUser
);
router.get('/list', userController.getUsers);
router.get('/details/:id', userController.getUserById);
router.delete('/delete/:id', userController.deleteUser);

// Route de mise à jour d'un utilisateur (avec upload Multer)
router.put(
    "/update/:id",
    upload.fields([
      { name: "photo", maxCount: 1 },                 // Pour la photo de profil
      { name: "image_carte_etudiant", maxCount: 1 },  // Pour la carte étudiante (optionnel)
    ]),
    userController.updateUser
  );
  router.put(
    "/updateDescription/:id",
    userController.onUpdateDescription
  );

router.post('/login', userController.user_signin);
router.post('/userwinthemailandpss', userController.getUserByEmailAndPassword);
router.post('/forgot-password', userController.sendResetCode);
router.post('/reset-code', userController.validateResetCode);
router.post('/reset-password', userController.resetPassword);

router.put('/toggle-block/:id', userController.toggleBlockUser);
router.get('/view/:id', userController.viewStudent);
router.get('/view/:id', userController.viewRestaurant);
router.get('/view/:id', userController.viewSupermarket);
router.get('/view/:id', userController.viewNGO);
router.get('/view/:id', userController.viewTransporter);
router.put("/update-user/:email", userController.updateUserWithEmail);
router.post('/createUser' , userController.createUser);
router.put('/deactivate-account/:id', userController.deactivateAccount);
router.put('/change-password/:id', userController.changePassword);
router.post("/send-2fa-code", userController.send2FACode);
router.post("/validate-2fa-code", userController.validate2FACode);
router.post("/toggle-2fa", userController.toggle2FA);
router.post("/send2FACodeforsigninwithgoogle", userController.send2FACodeforsigninwithgoogle);
module.exports = router;