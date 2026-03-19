import cors from "cors";
import express from "express";
import { z } from "zod";
import { generateSchedule } from "./scheduler.js";

const app = express();

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*"
};

app.use(cors(corsOptions));
app.use(express.json());

const availabilitySchema = z.object({
  day: z.enum(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/)
});

const employeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  isManager: z.boolean().default(false),
  preferredForMoreShifts: z.boolean().default(false),
  availability: z.array(availabilitySchema).default([])
});

const payloadSchema = z.object({
  employees: z.array(employeeSchema).min(1)
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/schedule/generate", (req, res) => {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      message: "מבנה הנתונים שנשלח מהקליינט אינו תקין.",
      details: parsed.error.issues
    });
  }

  const employees = parsed.data.employees;
  const totalAvailability = employees.reduce((sum, e) => sum + e.availability.length, 0);
  if (totalAvailability === 0) {
    return res.status(400).json({
      error: "No availability",
      message: "אין אף זמינות משובצת לעובדים. יש להגדיר לפחות טווח שעות אחד.",
      details: []
    });
  }

  try {
    const schedule = generateSchedule(employees);
    return res.json(schedule);
  } catch (err) {
    console.error("Failed generating schedule", err);
    return res.status(500).json({
      error: "Schedule generation failed",
      message: "הייתה שגיאה פנימית בחישוב הסידור. נסה שוב, ואם השגיאה חוזרת בדוק את לוג השרת."
    });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Scheduler API listening on port ${port}`);
});
