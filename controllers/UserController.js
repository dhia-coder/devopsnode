const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const twilio = require('twilio');
const crypto = require("crypto"); // For generating random reset codes
require("dotenv").config(); // Load environment variables

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

// Generate a 6-digit code (used for both reset and 2FA)
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
/////////////////////////////////

/////////////////////////////////////////////////////////
async function createUser(req, res) {
    try {
        const { name, email, photo } = req.body;   
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(200).json({ id: existingUser._id.toString() }); 
            // 🔹 Assure un ObjectId valide pour éviter l'erreur
        }

        const user = new User({ name, email, photo });
        await user.save();

        console.log("✅ Utilisateur créé avec ID:", user._id.toString()); // 🔹 Log l'ID correctement
        res.status(201).json({ id: user._id.toString() });

    } catch (error) {
        console.error("❌ Erreur API :", error.message);
        res.status(500).json({ message: "Error creating user" });
    }
}





// Generate a 6-digit reset code
const generateResetCode = () => Math.floor(100000 + Math.random() * 900000).toString(); 

// Function to generate a reset code and send it via email
// 🚀 Send Reset Code (Forgot Password)
async function sendResetCode(req, res) {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Generate reset code
        const resetCode = generateResetCode();

        // Store reset code & expiration
        user.resetCode = resetCode;
        user.resetCodeExpires = Date.now() + 10 * 60 * 1000; // Expires in 10 minutes
        await user.save();

        // Configure email transporter
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS, 
            },
            tls: {
                rejectUnauthorized: false, // Désactive la vérification SSL
            },
        });
        

        // Email details
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset Code",
            text: `Your password reset code is: ${resetCode}. This code is valid for 10 minutes.`,
        };

        // Send email
        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "Reset code sent successfully" });

    } catch (error) {
        console.error("Error sending reset code:", error);
        res.status(500).json({ error: "Error sending reset code" });
    }
}

// 🚀 Validate Reset Code
async function validateResetCode(req, res) {
    const { email, resetCode } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user || user.resetCode !== resetCode || user.resetCodeExpires < Date.now()) {
            return res.status(400).json({ error: "Invalid or expired reset code" });
        }

        res.status(200).json({ message: "Reset code verified" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
}

// 🚀 Reset Password
async function resetPassword(req, res) {
    const { email, newPassword } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password & clear reset code
        user.password = hashedPassword;
        user.resetCode = undefined;
        user.resetCodeExpires = undefined;
        await user.save();

        res.status(200).json({ message: "Password successfully reset" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
}





async function addUser(req, res) {
    try {
      const { email, password, confirmPassword, phone, name, address, role } = req.body;
  
      // Vérifier si tous les champs sont remplis
      if (!email || !password || !confirmPassword || !phone || !name || !address || !role) {
        return res.status(400).json({ error: "Veuillez remplir tous les champs." });
      }
  
      // Vérifier si les mots de passe correspondent
      if (password !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match" });
      }
      // ✅ Vérifier si l'email existe déjà
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }
  
      // Hacher le mot de passe avant de le stocker
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Construire l'objet utilisateur à partir de req.body
      const userData = { ...req.body, password: hashedPassword };
  
      // Si un fichier "photo" est uploadé, utilisez le chemin fourni par Multer
      if (req.files && req.files.photo && req.files.photo[0]) {
        userData.photo = req.files.photo[0].path;
      }
  
      // Si l'utilisateur est un étudiant et qu'un fichier "image_carte_etudiant" est uploadé, ajoutez-le
      if (role === 'student') {
        if (req.files && req.files.image_carte_etudiant && req.files.image_carte_etudiant[0]) {
          userData.image_carte_etudiant = req.files.image_carte_etudiant[0].path;
        }
      }
  
      // Créer l'utilisateur avec les données et le mot de passe haché
      const user = new User(userData);
      await user.save();
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  

// Get all users
async function getUsers(req, res) {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Get a user by ID
async function getUserById(req, res) {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getUserByEmailAndPassword(req, res) {
    const { email, password } = req.body; // Récupérer l'email et le mot de passe depuis le corps de la requête

    try {
        // Trouver l'utilisateur par email
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Vérifier le mot de passe
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid password" });
        }
        ////////////////////2fo
 // Étape 1 réussie : Envoyer un code de vérification
 await sendTwoFactorCode(user);

 res.status(200).json({ message: "Verification code sent to email", email });
 ////////////////////////////////
        // Si l'utilisateur est trouvé et le mot de passe est correct, renvoyer les détails de l'utilisateur
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
// Update a user
const updateUser = async (req, res) => {
    try {
      // Récupération des champs texte depuis le corps de la requête
      const {
        description,
        role,
        name,
        email,
        phone,
        address,
        photo, // optionnel si aucun fichier n'est envoyé
        age,
        sexe,
        image_carte_etudiant, // optionnel si aucun fichier n'est envoyé
        num_cin,
        id_fiscale,
        type,
        vehiculeType,
        taxReference,
        isBlocked,
        resetCode,
        resetCodeExpires
      } = req.body;
  
      // Construction de l'objet de mise à jour
      const updateData = {};
      if (description) updateData.description = description;
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (phone && !isNaN(phone)) updateData.phone = phone;
      if (address) updateData.address = address;
  
      // Si un fichier "photo" est uploadé, on utilise le chemin fourni par Multer,
      // sinon, on garde la valeur provenant du corps de la requête (si présente)
      if (req.files && req.files.photo && req.files.photo[0]) {
        updateData.photo = req.files.photo[0].path;
      } else if (photo) {
        updateData.photo = photo;
      }
  
      if (age && !isNaN(age)) updateData.age = age;
      if (sexe) updateData.sexe = sexe;
  
      // Pour "image_carte_etudiant" : priorité au fichier uploadé par Multer
      if (req.files && req.files.image_carte_etudiant && req.files.image_carte_etudiant[0]) {
        updateData.image_carte_etudiant = req.files.image_carte_etudiant[0].path;
      } else if (image_carte_etudiant) {
        updateData.image_carte_etudiant = image_carte_etudiant;
      }
  
      if (num_cin) updateData.num_cin = num_cin;
      if (id_fiscale) updateData.id_fiscale = id_fiscale;
      if (type) updateData.type = type;
      if (vehiculeType) updateData.vehiculeType = vehiculeType;
      if (taxReference) updateData.taxReference = taxReference;
      if (typeof isBlocked === "boolean") updateData.isBlocked = isBlocked;
      if (resetCode) updateData.resetCode = resetCode;
      if (resetCodeExpires) updateData.resetCodeExpires = resetCodeExpires;
  
      // Vérifier si l'utilisateur existe
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
  
      // Vérification pour empêcher la modification du rôle par un utilisateur non autorisé
     // if (req.body.role && req.user.role !== "admin") {
       // return res.status(403).json({ error: "Unauthorized to update role" });
     // }
      if (req.body.role) updateData.role = req.body.role;
  
      // Ne pas permettre la modification du mot de passe via cette méthode
      if (req.body.password) {
        return res.status(400).json({ error: "Password cannot be updated this way" });
      }
  
      // Mise à jour de l'utilisateur en BDD
      const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  // Update Description Controller
  const onUpdateDescription = async (req, res) => {
    try {
      const { id } = req.params; // Correct parameter name
      const { description } = req.body; // Expect description in body
  
      // Validate input
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ message: 'Description is required and must be a string' });
      }
      if (description.length > 500) {
        return res.status(400).json({ message: 'Description cannot exceed 500 characters' });
      }
  
      // Update User
      const updatedUser = await User.findOneAndUpdate(
        { _id: id },
        { description },
        { new: true, runValidators: true }
      );
  
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      res.status(200).json({
        message: 'Description updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Error updating description:', error);
      res.status(500).json({ message: 'Server error while updating description' });
    }
  };

  const updateUserWithEmail = async (req, res) => {
      try {
          const { email } = req.params;
          if (!email) {
              return res.status(400).json({ error: "Email is required" });
          }
  
          const {
              phone,
              address,
              photo,
              age,
              sexe,
              image_carte_etudiant,
              num_cin,
              id_fiscal,
              type,
              vehiculeType,
              taxReference,
              isBlocked,
              resetCode,
              resetCodeExpires,
              role
          } = req.body;
  
          const user = await User.findOne({ email: email });
          if (!user) {
              return res.status(404).json({ error: "User not found" });
          }
  
          if (role && req.user.role !== "admin") {
              return res.status(403).json({ error: "Unauthorized to update role" });
          }
  
          if (req.body.password) {
              return res.status(400).json({ error: "Password cannot be updated this way" });
          }
  
          const updateData = {};
          if (phone && !isNaN(phone)) updateData.phone = phone;
          if (address) updateData.address = address;
          if (age && !isNaN(age)) updateData.age = age;
          if (sexe) updateData.sexe = sexe;
          if (num_cin) updateData.num_cin = num_cin;
          if (id_fiscal) updateData.id_fiscal = id_fiscal;
          if (type) updateData.type = type;
          if (vehiculeType) updateData.vehiculeType = vehiculeType;
          if (taxReference) updateData.taxReference = taxReference;
          if (typeof isBlocked === "boolean") updateData.isBlocked = isBlocked;
          if (resetCode) updateData.resetCode = resetCode;
          if (resetCodeExpires) updateData.resetCodeExpires = resetCodeExpires;
          if (role) updateData.role = role;
  
          if (req.files?.photo?.[0]?.path) {
              updateData.photo = req.files.photo[0].path;
          } else if (photo) {
              updateData.photo = photo;
          }
  
          if (req.files?.image_carte_etudiant?.[0]?.path) {
              updateData.image_carte_etudiant = req.files.image_carte_etudiant[0].path;
          } else if (image_carte_etudiant) {
              updateData.image_carte_etudiant = image_carte_etudiant;
          }
  
          const updatedUser = await User.findOneAndUpdate(
              { email: email },
              updateData,
              { new: true }
          );
  
          if (!updatedUser) {
              return res.status(500).json({ error: "User update failed" });
          }
  
          // 🛑 Génération du token après mise à jour 🛑
          const token = jwt.sign(
              { id: updatedUser._id, email: updatedUser.email, role: updatedUser.role },
              process.env.JWT_SECRET, // Remplace par ta clé secrète
              { expiresIn: "1h" }
          );
  
          res.status(200).json({ user: updatedUser, token });
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  };
  


// 🚀 Block or Unblock User
async function toggleBlockUser(req, res) {
    try {
        const { id } = req.params; // Get user ID from request parameters

        // Find the user by ID
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Toggle the isBlocked field
        user.isBlocked = !user.isBlocked;
        await user.save();

        res.status(200).json({ message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully`, isBlocked: user.isBlocked });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'utilisateur:", error);
        res.status(500).json({ error: error.message });
    }
    
}


// Delete a user
async function deleteUser(req, res) {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
///////////////////////////////////////////hedhy badltha ///////////////////////////////////////////
// Signin (generate JWT token)
// Signin (generate JWT token)

async function user_signin(req, res) {
    console.log("Requête reçue :", req.body);

    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        if (user.isBlocked) {
            return res.status(403).json({ error: "Your account is blocked. Please contact support." });
        }

        let welcomeMessage = null;
        if (!user.isActive) {
            user.isActive = true;
            await user.save();
            welcomeMessage = "Your account has been reactivated. Welcome back!";
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        if (user.is2FAEnabled) {
            if (!user.phone || isNaN(user.phone)) {
                console.error("Invalid phone number in database:", user.phone);
                return res.status(500).json({ error: "User phone number is missing or invalid" });
            }

            const phoneWithPrefix = `+216${user.phone.toString()}`;
            console.log("Sending 2FA to:", phoneWithPrefix);

            try {
                const verification = await client.verify.v2
                    .services(verifyServiceSid)
                    .verifications.create({ to: phoneWithPrefix, channel: "sms" });
                console.log("Verification SID:", verification.sid);
            } catch (verifyError) {
                console.error("Verify API error:", verifyError.message, verifyError.stack);
                return res.status(500).json({ error: "Failed to send 2FA code via Verify API", details: verifyError.message });
            }

            return res.status(200).json({ message: "2FA code sent to your phone", requires2FA: true });
        }

        const payload = {
            userId: user._id,
            role: user.role,
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || "your_jwt_secret", { expiresIn: "1h" });
        res.status(200).json({
            token,
            role: user.role,
            id: user._id,
            message: welcomeMessage,
            is2FAEnabled: user.is2FAEnabled,
        });
    } catch (error) {
        console.error("Erreur serveur détaillée :", {
            message: error.message,
            stack: error.stack,
            requestBody: req.body,
        });
        res.status(500).json({ error: "Server error", details: error.message });
    }
}



  
// 🚀 View Student by ID
async function viewStudent(req, res) {
    try {
        // Retrieve student ID from request parameters
        const studentId = req.params.id;

        // Find the student by ID
        const student = await User.findById(studentId); // Assuming you're storing student data in the User model
        if (!student) {
            return res.status(404).json({ error: "Student not found" });
        }

        // Send the student details in the response
        res.status(200).json(student);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
}

async function viewRestaurant(req, res) {
    try {
        // Retrieve restaurant ID from request parameters
        const restaurantId = req.params.id;

        // Find the restaurant by ID (assuming you're storing restaurant data in the User model)
        const restaurant = await User.findById(restaurantId);
        
        // Check if the restaurant exists
        if (!restaurant) {
            return res.status(404).json({ error: "Restaurant not found" });
        }

        // Send the restaurant details in the response
        res.status(200).json(restaurant);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
}
async function viewSupermarket(req, res) {
    try {
        // Retrieve supermarket ID from request parameters
        const supermarketId = req.params.id;

        // Find the supermarket by ID (assuming you're storing supermarket data in the User model)
        const supermarket = await User.findById(supermarketId);
        
        // Check if the supermarket exists
        if (!supermarket) {
            return res.status(404).json({ error: "Supermarket not found" });
        }

        // Send the supermarket details in the response
        res.status(200).json(supermarket);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
}
async function viewNGO(req, res) {
    try {
        // Récupérer l'ID de l'ONG depuis les paramètres de la requête
        const ongId = req.params.id;

        // Trouver l'ONG par ID (en supposant que les ONG sont stockées dans le modèle User)
        const ong = await User.findById(ongId);
        
        // Vérifier si l'ONG existe
        if (!ong) {
            return res.status(404).json({ error: "ONG not found" });
        }

        // Envoyer les détails de l'ONG dans la réponse
        res.status(200).json(ong);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
}

async function viewTransporter(req, res) {
    try {
        // Récupérer l'ID du transporteur depuis les paramètres de la requête
        const transporterId = req.params.id;

        // Trouver le transporteur par ID (en supposant que les transporteurs sont stockés dans le modèle User)
        const transporter = await User.findById(transporterId);
        
        // Vérifier si le transporteur existe
        if (!transporter) {
            return res.status(404).json({ error: "Transporter not found" });
        }

        // Envoyer les détails du transporteur dans la réponse
        res.status(200).json(transporter);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
}
// 🚀 Deactivate Account
async function deactivateAccount(req, res) {
    try {
        const { id } = req.params; // Get user ID from request parameters

        // Check if ID is valid
        if (!id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        // Find and update the user
        const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({ message: "Account deactivated successfully", isActive: user.isActive });
    } catch (error) {
        console.error("Error deactivating account:", error);
        res.status(500).json({ error: "Server error" });
    }
}

// change password


async function changePassword(req, res) {
    try {
      // 1. Get the user ID from the route param
      const { id } = req.params; 
      const { currentPassword, newPassword } = req.body;
  
      if (!id) {
        return res.status(400).json({ error: "Missing user ID in route param." });
      }
  
      // 2. Find the user by ID
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }
  
      // 3. Compare the current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Current password is incorrect." });
      }
  
      // 4. Hash the new password
      user.password = await bcrypt.hash(newPassword, 10);
  
      // 5. Save and respond
      await user.save();
      return res.status(200).json({ message: "Password changed successfully." });
  
    } catch (error) {
      console.error("Error changing password:", error);
      return res.status(500).json({ error: "Server error." });
    }
  }
  
  
// Generate a 6-digit 2FA code
const generate2FACode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send 2FA code via Verify API
async function send2FACode(req, res) {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        if (!user.phone || isNaN(user.phone)) {
            return res.status(500).json({ error: "User phone number is missing or invalid" });
        }

        const phoneWithPrefix = `+216${user.phone.toString()}`;
        const twoFACode = generateCode();
        user.twoFACode = twoFACode;
        user.twoFACodeExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        try {
            const verification = await client.verify.v2
                .services(verifyServiceSid)
                .verifications.create({ to: phoneWithPrefix, channel: "sms" });
            console.log("Verification SID:", verification.sid);
        } catch (verifyError) {
            console.error("Verify API error:", verifyError.message, verifyError.stack);
            return res.status(500).json({ error: "Failed to send 2FA code via Verify API", details: verifyError.message });
        }

        res.status(200).json({ message: "2FA code sent successfully via SMS" });
    } catch (error) {
        console.error("Error sending 2FA code:", error);
        res.status(500).json({ error: "Error sending 2FA code", details: error.message });
    }
}
// Generate a 6-digit code (used for both reset and 2FA)
// Validate 2FA code
// Validate 2FA code
async function validate2FACode(req, res) {
    const { email, twoFACode } = req.body;
    console.log("Validating 2FA code:", { email, twoFACode, typeOfEmail: typeof email, typeOfTwoFACode: typeof twoFACode });

    // Validate input
    if (typeof email !== "string" || typeof twoFACode !== "string") {
        return res.status(400).json({ error: "Email and twoFACode must be strings" });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "User not found" });

        if (!user.phone || isNaN(user.phone)) {
            return res.status(400).json({ error: "User phone number is missing or invalid" });
        }

        const phoneWithPrefix = `+216${user.phone.toString()}`;
        console.log("Verifying 2FA for:", phoneWithPrefix);

        // Use Twilio Verify to check the code
        let verificationCheck;
        try {
            verificationCheck = await client.verify.v2
                .services(verifyServiceSid)
                .verificationChecks.create({ to: phoneWithPrefix, code: twoFACode });
            console.log("Verification Check Status:", verificationCheck.status);
        } catch (verifyError) {
            console.error("Verify Check API error:", verifyError.message, verifyError.stack);
            return res.status(500).json({ error: "Failed to verify 2FA code via Verify API", details: verifyError.message });
        }

        if (verificationCheck.status !== "approved") {
            return res.status(400).json({ error: "Invalid or expired 2FA code" });
        }

        // Debug user data before token generation
        console.log("User data for token:", {
            _id: user._id,
            email: user.email,
            role: user.role,
        });

        // Check JWT_SECRET
        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is not configured");
            return res.status(500).json({ error: "JWT_SECRET is not configured" });
        }

        // Generate JWT token
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
        console.log("Token generated:", token);

        res.status(200).json({ token, role: user.role, id: user._id.toString() });
    } catch (error) {
        console.error("Error in validate2FACode:", {
            message: error.message,
            stack: error.stack,
            requestBody: req.body,
        });
        res.status(500).json({ error: "Server error", details: error.message });
    }
}
// Toggle 2FA status
async function toggle2FA(req, res) {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        user.is2FAEnabled = !user.is2FAEnabled;
        await user.save();
        res.status(200).json({ message: `2FA ${user.is2FAEnabled ? "enabled" : "disabled"}` });
    } catch (error) {
        console.error("Error toggling 2FA:", error);
        res.status(500).json({ error: "Error toggling 2FA" });
    }
}

// Send 2FA code for Google sign-in via Verify API
const send2FACodeforsigninwithgoogle = async (req, res) => {
    try {
        const { email, phone } = req.body;

        if (!phone) return res.status(400).json({ error: "Phone number is required for SMS 2FA" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!user.is2FAEnabled) return res.status(400).json({ message: "2FA not enabled for this user", requires2FA: false });

        const twoFACode = generateCode();
        user.twoFACode = twoFACode;
        user.twoFACodeExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        const phoneWithPrefix = `+216${phone.toString()}`;
        try {
            const verification = await client.verify.v2
                .services(verifyServiceSid)
                .verifications.create({ to: phoneWithPrefix, channel: "sms" });
            console.log("Verification SID:", verification.sid);
        } catch (verifyError) {
            console.error("Verify API error:", verifyError.message, verifyError.stack);
            return res.status(500).json({ message: "Failed to send 2FA code via Verify API", details: verifyError.message });
        }

        return res.status(200).json({ message: "2FA code sent to your phone", requires2FA: true });
    } catch (error) {
        console.error("❌ Error sending 2FA code via SMS:", error);
        return res.status(500).json({ message: "Failed to send 2FA code via SMS", details: error.message });
    }
};

module.exports = {onUpdateDescription,send2FACode,send2FACodeforsigninwithgoogle,changePassword,updateUserWithEmail, createUser,addUser, getUsers, getUserById,updateUser, deleteUser, user_signin,getUserByEmailAndPassword , resetPassword ,validateResetCode,sendResetCode , toggleBlockUser , viewStudent , viewRestaurant , viewSupermarket, viewNGO , viewTransporter ,deactivateAccount  , validate2FACode , toggle2FA};