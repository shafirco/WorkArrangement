export const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const WD_COMMON = [
  { id: "morning_10_16", dayType: "weekday", dayLabel: "א-ד", start: "10:00", end: "16:00", preferManager: true, requiredManager: false },
  { id: "evening_mgr_16_24", dayType: "weekday", dayLabel: "א-ד", start: "16:00", end: "24:00", preferManager: true, requiredManager: true },
  { id: "evening_reg_17_24", dayType: "weekday", dayLabel: "א-ד", start: "17:00", end: "24:00", preferManager: false, requiredManager: false }
];

const THURSDAY_EXTRA = [
  { id: "evening_extra_19_24", dayType: "thursday", dayLabel: "ה", start: "19:00", end: "24:00", preferManager: false, requiredManager: false }
];

const FRIDAY = [
  { id: "morning_0830_17", dayType: "friday", dayLabel: "ו", start: "08:30", end: "17:00", preferManager: true, requiredManager: false },
  { id: "midday_11_18", dayType: "friday", dayLabel: "ו", start: "11:00", end: "18:00", preferManager: false, requiredManager: false },
  { id: "afternoon_13_19", dayType: "friday", dayLabel: "ו", start: "13:00", end: "19:00", preferManager: false, requiredManager: false },
  { id: "evening_mgr_17_02", dayType: "friday", dayLabel: "ו", start: "17:00", end: "02:00", preferManager: true, requiredManager: false },
  { id: "evening_18_02", dayType: "friday", dayLabel: "ו", start: "18:00", end: "02:00", preferManager: false, requiredManager: false },
  { id: "evening_19_02", dayType: "friday", dayLabel: "ו", start: "19:00", end: "02:00", preferManager: false, requiredManager: false },
  { id: "evening_20_02_a", dayType: "friday", dayLabel: "ו", start: "20:00", end: "02:00", preferManager: false, requiredManager: false },
  { id: "evening_20_02_b", dayType: "friday", dayLabel: "ו", start: "20:00", end: "02:00", preferManager: false, requiredManager: false }
];

const SATURDAY = [
  { id: "morning_0830_16", dayType: "saturday", dayLabel: "שבת", start: "08:30", end: "16:00", preferManager: true, requiredManager: false },
  { id: "midday_11_18", dayType: "saturday", dayLabel: "שבת", start: "11:00", end: "18:00", preferManager: false, requiredManager: false },
  { id: "afternoon_13_19", dayType: "saturday", dayLabel: "שבת", start: "13:00", end: "19:00", preferManager: false, requiredManager: false },
  { id: "afternoon_15_22", dayType: "saturday", dayLabel: "שבת", start: "15:00", end: "22:00", preferManager: false, requiredManager: false },
  { id: "evening_mgr_16_00", dayType: "saturday", dayLabel: "שבת", start: "16:00", end: "00:00", preferManager: true, requiredManager: false },
  { id: "evening_18_00_a", dayType: "saturday", dayLabel: "שבת", start: "18:00", end: "00:00", preferManager: false, requiredManager: false },
  { id: "evening_18_00_b", dayType: "saturday", dayLabel: "שבת", start: "18:00", end: "00:00", preferManager: false, requiredManager: false },
  { id: "evening_19_00", dayType: "saturday", dayLabel: "שבת", start: "19:00", end: "00:00", preferManager: false, requiredManager: false }
];

export function buildWeekShifts() {
  const shifts = [];

  for (const day of ["sunday", "monday", "tuesday", "wednesday"]) {
    WD_COMMON.forEach((template, idx) => {
      shifts.push({
        slotId: `${day}_${template.id}_${idx}`,
        day,
        ...template
      });
    });
  }

  const thursdayBase = [...WD_COMMON, ...THURSDAY_EXTRA];
  thursdayBase.forEach((template, idx) => {
    shifts.push({
      slotId: `thursday_${template.id}_${idx}`,
      day: "thursday",
      ...template
    });
  });

  FRIDAY.forEach((template, idx) => {
    shifts.push({
      slotId: `friday_${template.id}_${idx}`,
      day: "friday",
      ...template
    });
  });

  SATURDAY.forEach((template, idx) => {
    shifts.push({
      slotId: `saturday_${template.id}_${idx}`,
      day: "saturday",
      ...template
    });
  });

  return shifts;
}
