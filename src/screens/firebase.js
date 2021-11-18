// Import the functions you need from the SDKs you need

import * as firebase from "firebase" ;
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDdWmIpS3hKq4jBIMzOYWw8GNVXPxjmIi8",
    authDomain: "thestorycreatorapp-6085f.firebaseapp.com",
    projectId: "thestorycreatorapp-6085f",
    storageBucket: "thestorycreatorapp-6085f.appspot.com",
    messagingSenderId: "998849769569",
    appId: "1:998849769569:web:e2463d76e434ad6c9efa20",
    measurementId: "G-SRTFB39YF2"
};

// Initialize Firebase

let app;
if(firebase.apps.length === 0){
    app = firebase.initializeApp(firebaseConfig)
}else {
    app = firebase.default.app();
}

const auth = firebase.default.auth()

const analytics = getAnalytics(app);

export { auth }