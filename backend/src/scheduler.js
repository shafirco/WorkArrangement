import { buildWeekShifts } from "./shiftTemplates.js";

function toMinutes(timeValue) {
  const [hh, mm] = timeValue.split(":").map(Number);
  return hh * 60 + mm;
}

function availabilityCovers(slot, a) {
  if (slot.day !== a.day) return false;
  const slotStart = toMinutes(slot.start);
  let slotEnd = toMinutes(slot.end);
  if (slotEnd <= slotStart) slotEnd += 24 * 60;
  const availabilityStart = toMinutes(a.start);
  let availabilityEnd = toMinutes(a.end);
  if (availabilityEnd <= availabilityStart) availabilityEnd += 24 * 60;
  return availabilityStart <= slotStart && availabilityEnd >= slotEnd;
}

function slotDurationMinutes(slot) {
  const slotStart = toMinutes(slot.start);
  let slotEnd = toMinutes(slot.end);
  if (slotEnd <= slotStart) slotEnd += 24 * 60;
  return slotEnd - slotStart;
}

function shiftPriority(slot, employee) {
  let score = 0;

  if (slot.preferManager && employee.isManager) score += 25;
  if (slot.requiredManager && !employee.isManager) score -= 80;
  if (employee.preferredForMoreShifts) score += 6;

  // Prioritize employees who are below their proportional target.
  const deficit = employee.targetShare - employee.assignedCount;
  score += deficit * 20;

  // Strong push for workers with 3+ options to get at least one shift.
  if (employee.minRequired > 0 && employee.assignedCount < employee.minRequired) {
    score += 45;
  }

  return score;
}

export function generateSchedule(inputEmployees) {
  const weekShifts = buildWeekShifts();
  const totalSlots = weekShifts.length;

  const employees = inputEmployees.map((e) => {
    const availabilityCount = Array.isArray(e.availability) ? e.availability.length : 0;
    const preferredBoost = e.preferredForMoreShifts ? 1.2 : 1;
    return {
      ...e,
      availability: e.availability || [],
      assignedCount: 0,
      assignedDays: new Set(),
      minRequired: availabilityCount >= 3 ? 1 : 0,
      rawWeight: Math.max(0.1, availabilityCount * preferredBoost),
      targetShare: 0
    };
  });

  const totalWeight = employees.reduce((sum, e) => sum + e.rawWeight, 0);
  employees.forEach((e) => {
    e.targetShare = (e.rawWeight / Math.max(totalWeight, 0.0001)) * totalSlots;
  });

  const results = [];
  const warnings = [];

  for (const slot of weekShifts) {
    const duration = slotDurationMinutes(slot);
    if (duration > 10 * 60) {
      warnings.push(`משמרת ארוכה מ-10 שעות ולכן נשארה ריקה: ${slot.day} ${slot.start}-${slot.end}`);
      results.push({ ...slot, employeeId: null, employeeName: null });
      continue;
    }

    const candidates = employees
      .filter((employee) => !employee.assignedDays.has(slot.day))
      .filter((employee) => employee.availability.some((a) => availabilityCovers(slot, a)))
      .sort((a, b) => shiftPriority(slot, b) - shiftPriority(slot, a));

    if (candidates.length === 0) {
      warnings.push(`אין מועמד פנוי עבור ${slot.day} ${slot.start}-${slot.end}`);
      results.push({
        ...slot,
        employeeId: null,
        employeeName: null,
        availableCandidates: employees
          .filter((employee) => employee.availability.some((a) => availabilityCovers(slot, a)))
          .map((employee) => ({ id: employee.id, name: employee.name, isManager: !!employee.isManager }))
      });
      continue;
    }

    let chosen = candidates[0];
    if (slot.requiredManager) {
      const manager = candidates.find((c) => c.isManager);
      if (manager) chosen = manager;
    }

    chosen.assignedCount += 1;
    chosen.assignedDays.add(slot.day);
    results.push({
      ...slot,
      employeeId: chosen.id,
      employeeName: chosen.name,
      isManagerAssigned: chosen.isManager,
      availableCandidates: employees
        .filter((employee) => employee.availability.some((a) => availabilityCovers(slot, a)))
        .map((employee) => ({ id: employee.id, name: employee.name, isManager: !!employee.isManager }))
    });
  }

  // Repair pass: try to satisfy minimum one shift for employees with >=3 options.
  const minNeeded = employees.filter((e) => e.minRequired > 0 && e.assignedCount < e.minRequired);
  for (const employee of minNeeded) {
    // First, take an unassigned compatible slot.
    const unassignedSlot = results.find(
      (slot) =>
        !slot.employeeId &&
        !employee.assignedDays.has(slot.day) &&
        employee.availability.some((a) => availabilityCovers(slot, a))
    );
    if (unassignedSlot) {
      unassignedSlot.employeeId = employee.id;
      unassignedSlot.employeeName = employee.name;
      unassignedSlot.isManagerAssigned = employee.isManager;
      employee.assignedCount += 1;
      employee.assignedDays.add(unassignedSlot.day);
      continue;
    }

    // Otherwise, swap from someone with more than minimum/target pressure.
    const swappableSlot = results.find((slot) => {
      if (!slot.employeeId) return false;
      if (slot.day && employee.assignedDays.has(slot.day)) return false;
      const canCover = employee.availability.some((a) => availabilityCovers(slot, a));
      if (!canCover) return false;
      const current = employees.find((e) => e.id === slot.employeeId);
      if (!current) return false;
      const minFloor = current.minRequired || 0;
      return current.assignedCount > Math.max(minFloor, 1);
    });

    if (swappableSlot) {
      const current = employees.find((e) => e.id === swappableSlot.employeeId);
      if (current) {
        current.assignedCount -= 1;
        current.assignedDays.delete(swappableSlot.day);
      }
      swappableSlot.employeeId = employee.id;
      swappableSlot.employeeName = employee.name;
      swappableSlot.isManagerAssigned = employee.isManager;
      employee.assignedCount += 1;
      employee.assignedDays.add(swappableSlot.day);
    }
  }

  const employeeStats = employees.map((e) => ({
    id: e.id,
    name: e.name,
    assignedCount: e.assignedCount,
    availabilityCount: e.availability.length,
    preferredForMoreShifts: !!e.preferredForMoreShifts,
    assignmentRatio: e.availability.length > 0 ? e.assignedCount / e.availability.length : 0,
    targetShare: e.targetShare
  }));

  return { shifts: results, warnings, employeeStats };
}
