import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoint to send SMS notifications
  app.post("/api/notify-donors", async (req, res) => {
    const { donors, message } = req.body;

    if (!donors || !Array.isArray(donors) || !message) {
      return res.status(400).json({ error: "Invalid request. 'donors' (array) and 'message' are required." });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(500).json({ 
        error: "Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in environment variables." 
      });
    }

    const client = twilio(accountSid, authToken);

    const results = [];
    for (const donor of donors) {
      try {
        // Ensure number has country code (default to 88 for Bangladesh if not present)
        let to = donor.replace(/\D/g, '');
        if (!to.startsWith('88')) {
          to = '88' + to;
        }
        to = '+' + to;

        const response = await client.messages.create({
          body: message,
          from: fromNumber,
          to: to,
        });
        results.push({ to: donor, status: "success", sid: response.sid });
      } catch (error: any) {
        console.error(`Failed to send SMS to ${donor}:`, error.message);
        results.push({ to: donor, status: "failed", error: error.message });
      }
    }

    res.json({ results });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
