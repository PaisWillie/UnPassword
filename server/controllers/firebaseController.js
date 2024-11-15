// Import the Firestore SDK
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDoc, doc, addDoc, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import { configDotenv } from "dotenv";
import crypto from "crypto";
const dotenv = configDotenv();

// Your web app's Firebase configuration

const firebaseConfig = {
    apiKey: process.env.FIREBASE_APIKEY,
    authDomain: process.env.FIREBASE_AUTHDOMAIN,
    projectId: process.env.FIREBASE_PROJECTID,
    storageBucket: process.env.FIREBASE_STORAGEBUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGINGSENDERID,
    appId: process.env.FIREBASE_APPID,
    measurementId: process.env.FIREBASE_MEASUREMENTID
};
  
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const usersRef = collection(db, 'users');

// Define encryption/decryption parameters
const ALGORITHM = process.env.DES_ALGORITHM;
const SECRET_KEY = Buffer.from(process.env.DES_SECRET_KEY, "hex"); // 24 bytes (48 hex chars)
const IV = Buffer.from(process.env.DES_IV, "hex"); // 8 bytes (16 hex chars)


const encrypt = (data) => {
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, IV);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
};

// Function to decrypt data using 3DES
const decrypt = (encryptedData) => {
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, IV);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
};

const addUserHelper = async (id) => {
    const userDoc = doc(usersRef, id);
    await setDoc(userDoc, {}); // Initializes user document with an empty object
    console.log(`User ${id} created successfully.`);
}

const addUser = async (req, res) => {
    const id = req.auth.payload.sub;
    try {
        // Check if user already exists
        const userDoc = doc(usersRef, id);
        const userDocSnap = await getDoc(userDoc);
        if (userDocSnap.exists()) {
            console.log(`User ${id} already exists.`);
            res.json({ message: `User ${id} already exists.` });
        } else {
            // If user does not exist, create a new user
            await addUserHelper(id);
            res.json({ message: `User ${id} created successfully.` });
        }
    } catch (error) {
    console.error("Error creating user:", error);
    }
}

const addUserLogin = async (req, res) => {
    const id = req.auth.payload.sub;
    const { platform, username, password } = req.body;
    try {
      // Encrypt username and password
      const encryptedUsername = encrypt(username);
      const encryptedPassword = encrypt(password);
  
      const userLoginDoc = doc(db, `users/${id}/logins`, platform);
      await setDoc(
        userLoginDoc,
        {
          username: encryptedUsername,
          password: encryptedPassword
        },
        { merge: true } // Merges if the platform exists, creates if not
      );
  
      console.log(`Login for platform ${platform} added/updated successfully for user ${id}.`);
      res.json({ message: `Login for platform ${platform} added/updated successfully for user ${id}.` });
    } catch (error) {
      console.error("Error adding/updating user login:", error);
      res.status(500).json({ error: "Error adding/updating login." });
    }
  };


  const getUserLogins = async (req, res) => {
    // decode jwt to get user id
    const id = req.auth.payload.sub;
    try {
        // if the user does not exist, make a new user and return an empty array
        const userDoc = doc(usersRef, id);
        const userDocSnap = await getDoc(userDoc);
        if (!userDocSnap.exists()) {
            console.log(`User ${id} does not exist.`);
            await addUserHelper(id);
            res.json([]);
            return;
        }
        // Reference the logins subcollection within the user's document
        const userLoginsRef = collection(db, `users/${id}/logins`);
        
        // Retrieve all documents within the logins subcollection
        const querySnapshot = await getDocs(userLoginsRef);
        
        // Map each document in the query snapshot to an object with id and data
        const logins = querySnapshot.docs.map(doc => {
            const loginData = doc.data();
            // Decrypt the username and password
            const decryptedUsername = decrypt(loginData.username);
            const decryptedPassword = decrypt(loginData.password);

            // Return the decrypted login data
            return {
                platform: doc.id,
                username: decryptedUsername,
                password: decryptedPassword,
            };
        });
        
        console.log(`User logins retrieved and decrypted successfully for user ${id}`);
        res.json(logins);
    } catch (error) {
        console.error("Error getting user logins:", error);
        res.status(500).json({ error: "Failed to retrieve logins" });
    }
};

const deleteLogin = async (req, res) => {
    const id = req.auth.payload.sub;
    const platform = req.body.platform;
    try {
      const userLoginDoc = doc(db, `users/${id}/logins`, platform);
        await deleteDoc(userLoginDoc);
      console.log(`Login for platform ${platform} deleted successfully for user ${id}.`);
      res.json({ message: `Login for platform ${platform} deleted successfully for user ${id}.` });
    } catch (error) {
      console.error("Error deleting user login:", error);
      res.status(500).json({ error: "Error deleting login." });
    }
};

export { addUser, addUserLogin, getUserLogins, deleteLogin };