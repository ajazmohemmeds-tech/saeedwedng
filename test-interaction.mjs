import { initializeApp } from "firebase/app";
import { getFirestore, addDoc, collection, updateDoc, arrayUnion } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDABXfuMeGsTO1rxGihBTDGauIJcZ1fJGU",
  authDomain: "saeed-anzi-wedding.firebaseapp.com",
  projectId: "saeed-anzi-wedding",
  storageBucket: "saeed-anzi-wedding.firebasestorage.app",
  messagingSenderId: "889701160746",
  appId: "1:889701160746:web:33a62691f510466b46f053",
  measurementId: "G-RFQDD5Q52V"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testInteraction() {
  try {
    const visitRef = await addDoc(collection(db, "visits"), {
        device: "Desktop", timestamp: new Date(), interactions: [], duration: 0
    });
    console.log("Created visit:", visitRef.id);
    
    await updateDoc(visitRef, {
        interactions: arrayUnion({ type: "test_click", time: Date.now() })
    });
    console.log("Successfully added interaction!");
  } catch (e) {
      console.error("FAILED:", e.message);
  }
}
testInteraction();
