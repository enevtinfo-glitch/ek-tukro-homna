import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { db, auth } from "../firebase";
import { collection, addDoc, serverTimestamp, setDoc, doc } from "firebase/firestore";

const SYSTEM_PROMPT = `You are an empathetic, fast, and helpful AI assistant for a non-profit Free Blood Donation Organization named "এক টুকরো হোমনা" (Ek Tukro Homna). Your main job is to help people in emergencies and assist blood donors.

Your key responsibilities:

1. Emergency Blood Requests: If someone needs blood, quickly identify the 'Blood Group', 'Location', and 'Contact Number' from their message. If any info is missing, ask for it politely and quickly. Once all information is collected, use the 'save_blood_request' tool to save it.

2. Donor Registration: Guide users to register as donors by asking their Name, Blood Group, Location, and Last Donation Date. Once all information is collected, use the 'register_donor' tool to save it. You can also tell them they can share a direct registration link by adding '?register=true' to the URL (e.g., https://.../index.html?register=true).

3. General Information: Answer questions about blood donation rules (e.g., minimum age, weight requirements, 3-4 months time gap between donations) and post-donation care.

Tone: Always be polite, calming, and supportive. Treat emergency requests with high priority.

Remember: You are a virtual assistant. You cannot physically manage blood, but you will collect the correct information from the user and assure them that the organization's volunteers will check the database and contact them immediately.`;

const saveBloodRequestDeclaration: FunctionDeclaration = {
  name: "save_blood_request",
  parameters: {
    type: Type.OBJECT,
    description: "Save an emergency blood request to the database.",
    properties: {
      bloodGroup: {
        type: Type.STRING,
        enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
        description: "The required blood group."
      },
      location: {
        type: Type.STRING,
        description: "The location where blood is needed."
      },
      contactNumber: {
        type: Type.STRING,
        description: "The contact number for the request."
      }
    },
    required: ["bloodGroup", "location", "contactNumber"]
  }
};

const registerDonorDeclaration: FunctionDeclaration = {
  name: "register_donor",
  parameters: {
    type: Type.OBJECT,
    description: "Register a new blood donor in the database.",
    properties: {
      name: {
        type: Type.STRING,
        description: "The full name of the donor."
      },
      bloodGroup: {
        type: Type.STRING,
        enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
        description: "The donor's blood group."
      },
      location: {
        type: Type.STRING,
        description: "The donor's location."
      },
      mobileNumber: {
        type: Type.STRING,
        description: "The donor's mobile number."
      },
      lastDonationDate: {
        type: Type.STRING,
        description: "The date of the last donation (YYYY-MM-DD)."
      }
    },
    required: ["name", "bloodGroup", "location", "mobileNumber"]
  }
};

export async function handleChat(message: string, history: any[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [saveBloodRequestDeclaration, registerDonorDeclaration] }]
    },
    history: history
  });

  const response = await chat.sendMessage({ message });
  
  if (response.functionCalls) {
    const call = response.functionCalls[0];
    return { 
      text: "আমি আপনার তথ্যগুলো সংগ্রহ করেছি। আপনি কি নিশ্চিত যে আমি এগুলো সংরক্ষণ করব?", 
      pendingAction: {
        name: call.name,
        args: call.args
      }
    };
  }

  return { text: response.text, pendingAction: null };
}

export async function executeAction(action: { name: string, args: any }) {
  if (action.name === "save_blood_request") {
    const { bloodGroup, location, contactNumber } = action.args;
    try {
      await addDoc(collection(db, "bloodRequests"), {
        bloodGroup,
        location,
        contactNumber,
        status: "pending",
        createdAt: serverTimestamp(),
        uid: "anonymous"
      });
      return { success: true, message: "ধন্যবাদ। আপনার রক্ত সাহায্যের আবেদনটি আমাদের সিস্টেমে জমা হয়েছে।" };
    } catch (error) {
      console.error("Error saving blood request:", error);
      return { success: false, message: "দুঃখিত, তথ্যটি সংরক্ষণ করতে সমস্যা হয়েছে।" };
    }
  } else if (action.name === "register_donor") {
    const { name, bloodGroup, location, mobileNumber, lastDonationDate } = action.args;
    try {
      const donorId = `donor_${Date.now()}`;
      await setDoc(doc(db, "donors", donorId), {
        name,
        bloodGroup,
        location,
        mobileNumber,
        lastDonationDate: lastDonationDate || null,
        uid: donorId,
        createdAt: serverTimestamp()
      });
      return { success: true, message: "অভিনন্দন! আপনি সফলভাবে রক্তদাতা হিসেবে নিবন্ধিত হয়েছেন।" };
    } catch (error) {
      console.error("Error registering donor:", error);
      return { success: false, message: "দুঃখিত, নিবন্ধন করতে সমস্যা হয়েছে।" };
    }
  }
  return { success: false, message: "অজানা কমান্ড।" };
}
